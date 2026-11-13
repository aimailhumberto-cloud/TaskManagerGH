'use client';
import { contactConnections, distributorContacts, type ContactNode, type ContactLink } from '@/lib/contactLayer';
import { humanNodeName } from '@/lib/smjIdentity';
import { useConnT } from '@/lib/connectionsI18n';

export function ContactLayer({ node, nodes, links, onOpen }: {
  node: ContactNode; nodes: ContactNode[]; links: ContactLink[];
  onOpen: (target: ContactNode, sourceId: string) => void;
}) {
  const { T } = useConnT();
  if (node.type !== 'distributor' && node.type !== 'person') return null;
  const contacts = node.type === 'distributor' ? distributorContacts(node.id, nodes, links) : [node];
  return (
    <section aria-label={node.type === 'distributor' ? T('Contactos del distribuidor') : T('Conectividades del contacto')} className="mb-3 rounded-xl border border-indigo-500/50 bg-gray-950/90 p-3 text-xs">
      <h3 className="font-semibold text-indigo-200">{node.type === 'distributor' ? `${T('Contactos')} · ${contacts.length}` : T('Conectividades')}</h3>
      {contacts.length === 0 && <p className="mt-2 text-gray-300">{T('Aún no hay personas de contacto vinculadas.')}</p>}
      {contacts.map(contact => (
        <div key={contact.id} className="mt-3">
          {node.type === 'distributor' && <button type="button" onClick={() => onOpen(contact, node.id)} className="rounded text-left font-semibold text-white underline decoration-indigo-400 underline-offset-4 hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">{humanNodeName(contact)}</button>}
          {contact.frontmatter?.phone_mobile && <p className="mt-1 select-all text-gray-300">{contact.frontmatter.phone_mobile}</p>}
          <ul className="mt-2 space-y-1">
            {contactConnections(contact.id, nodes, links).map(({ node: other, labels }) => (
              <li key={other.id}>
                <button type="button" onClick={() => onOpen(other, contact.id)} className="w-full rounded px-2 py-2 text-left text-indigo-100 hover:bg-indigo-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300">
                  <span className="block break-words">{humanNodeName(other).replace(/^(Distributor|Market):\s*/i, '')}</span>
                  <span className="block text-[11px] text-gray-300">{labels.map(T).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
