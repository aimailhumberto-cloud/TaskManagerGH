const { loadBrainGraph, readVaultFile, listVaultFiles, getVaultPath } = require('../src/lib/smjBrainService');

async function runAudit() {
  console.log('🧪 Iniciando verificación del Vault en la nube y posición Apex...');

  const vaultPath = getVaultPath();
  console.log('📁 Vault activo:', vaultPath);

  const files = listVaultFiles();
  console.log(`📦 Archivos listados por el servicio: ${files.length}`);

  const aleemFile = readVaultFile('01-Internal-Clients/Person - Aleem Mohammed.md');
  if (!aleemFile.ok) {
    throw new Error('❌ No se encontró el archivo de Dr. Aleem Mohammed!');
  }
  console.log('✅ Archivo de Dr. Aleem Mohammed leído exitosamente.');

  const graph = loadBrainGraph();
  console.log(`📊 Nodos cargados en el grafo: ${graph.nodes.length}, Enlaces: ${graph.links.length}`);

  const aleemNode = graph.nodes.find(n => n.id.includes('aleem'));
  if (!aleemNode) {
    throw new Error('❌ Dr. Aleem Mohammed no encontrado en los nodos del grafo!');
  }
  console.log('✅ Dr. Aleem Mohammed presente:', {
    id: aleemNode.id,
    title: aleemNode.title,
    hierarchy_level: aleemNode.hierarchy_level,
    job_title: aleemNode.frontmatter?.job_title,
    supervises: aleemNode.frontmatter?.relations?.supervises,
  });

  if (aleemNode.hierarchy_level !== 0) {
    throw new Error(`❌ hierarchy_level de Dr. Aleem debe ser 0, pero es ${aleemNode.hierarchy_level}`);
  }

  // Check markets
  const barbados = graph.nodes.find(n => n.id.includes('barbados'));
  const guyana = graph.nodes.find(n => n.id.includes('guyana'));
  const stLucia = graph.nodes.find(n => n.id.includes('saint-lucia') || n.id.includes('st-lucia'));
  const suriname = graph.nodes.find(n => n.id.includes('suriname'));

  console.log('🌎 Mercados verificados:');
  console.log(' - Barbados:', barbados ? barbados.title : 'NO ENCONTRADO');
  console.log(' - Guyana:', guyana ? guyana.title : 'NO ENCONTRADO');
  console.log(' - Saint Lucia:', stLucia ? stLucia.title : 'NO ENCONTRADO');
  console.log(' - Suriname:', suriname ? suriname.title : 'NO ENCONTRADO');

  if (!barbados || !guyana) {
    throw new Error('❌ Faltan mercados clave en el grafo!');
  }

  console.log('🎉 ¡Todas las verificaciones de datos pasaron con 100% de éxito!');
}

runAudit().catch(err => {
  console.error('❌ Error en auditoría:', err);
  process.exit(1);
});
