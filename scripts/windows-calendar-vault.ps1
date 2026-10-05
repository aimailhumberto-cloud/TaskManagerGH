# Secrets travel only through redirected stdin/stdout, never command arguments or logs.
$ErrorActionPreference = 'Stop'
$phase = 'input'
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($request.target -notmatch '^TaskManagerHB/GoogleCalendar/(primary|test-[a-zA-Z0-9-]+)$') { throw 'Invalid target' }
  $phase = 'native-helper'
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CalendarVault {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Credential {
    public uint Flags, Type; public string TargetName, Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob;
    public uint Persist, AttributeCount; public IntPtr Attributes;
    public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Write(ref Credential credential, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Read(string target, uint type, uint flags, out IntPtr pointer);
  [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Delete(string target, uint type, uint flags);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr pointer);
  public static void Put(string target, string value) {
    byte[] bytes = Encoding.UTF8.GetBytes(value);
    if (bytes.Length > 2560) throw new Exception("Credential too large");
    IntPtr pointer = Marshal.AllocHGlobal(bytes.Length);
    try {
      Marshal.Copy(bytes, 0, pointer, bytes.Length);
      Credential c = new Credential { Type=1, TargetName=target, CredentialBlobSize=(uint)bytes.Length,
        CredentialBlob=pointer, Persist=2, UserName="TaskManager HB" };
      if (!Write(ref c, 0)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    } finally { for (int i=0;i<bytes.Length;i++) Marshal.WriteByte(pointer,i,0); Marshal.FreeHGlobal(pointer); Array.Clear(bytes,0,bytes.Length); }
  }
  public static string Get(string target) {
    IntPtr pointer;
    if (!Read(target, 1, 0, out pointer)) {
      if (Marshal.GetLastWin32Error() == 1168) return null;
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      Credential c = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
      byte[] bytes = new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob,bytes,0,bytes.Length);
      try { return Encoding.UTF8.GetString(bytes); } finally { Array.Clear(bytes,0,bytes.Length); }
    } finally { CredFree(pointer); }
  }
  public static void Remove(string target) {
    if (!Delete(target,1,0) && Marshal.GetLastWin32Error()!=1168) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
}
'@
  $phase = 'credential-operation'
  switch ($request.action) {
    'read' { $value = [CalendarVault]::Get($request.target); if ($null -eq $value) { [Console]::Out.Write('null') } else { [Console]::Out.Write($value) } }
    'write' { [CalendarVault]::Put($request.target, [string]$request.value); [Console]::Out.Write('{"ok":true}') }
    'delete' { [CalendarVault]::Remove($request.target); [Console]::Out.Write('{"ok":true}') }
    default { throw 'Invalid operation' }
  }
} catch {
  $exception = $_.Exception
  while ($exception.InnerException) { $exception = $exception.InnerException }
  $nativeCode = if ($exception -is [System.ComponentModel.Win32Exception]) { $exception.NativeErrorCode } else { 0 }
  [Console]::Error.Write('Windows Credential Manager unavailable at ' + $phase + ' (' + $exception.GetType().Name + ', code ' + $nativeCode + ').'); exit 1
}
