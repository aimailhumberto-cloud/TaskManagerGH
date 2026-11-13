'use client';
import { useCallback } from 'react';
import { useUiLang } from './uiLang';

/** Textos en inglés de las conexiones del Cerebro (comerciales, contactos, portafolio). La clave es el texto en español. */
export const CONN_EN: Record<string, string> = {
  'Red comercial': 'Commercial network', 'Distribuidores': 'Distributors', 'Personas de contacto': 'Contact people', 'Coordinación SMJ': 'SMJ coordination', 'Canales': 'Channels', 'Cadenas y cuentas': 'Chains and accounts',
  'Outlets y puntos de atención': 'Outlets and service points', 'Referencias que maneja': 'Items it carries', 'Marcas y líneas': 'Brands and lines', 'Mercados': 'Markets', 'Empaques': 'Packaging', 'Proyectos': 'Projects',
  'Dirección': 'Address', 'Teléfono': 'Phone', 'Pedidos': 'Orders', 'Observación de catálogo · stock por verificar': 'Catalog observation · stock to be verified', 'Código en esta fuente:': 'Code in this source:',
  'Stock actual, ventas y cobertura por sucursal: por verificar.': 'Current stock, sales and coverage by branch: to be verified.', 'Consultar fuente': 'View source', 'Metas · nov 2026–abr 2027 ·': 'Targets · Nov 2026–Apr 2027 ·', 'cajas': 'cases',
  'Metas del mercado. Ventas reales y asignación por distribuidor pendientes.': 'Market targets. Actual sales and allocation by distributor are pending.', 'Metas de Canadá por marca, seis meses': 'Canada targets by brand, six months',
  'Busta diciembre: sin meta definida. Trinidad Juices: sin fila de volumen.': 'Busta December: no target defined. Trinidad Juices: no volume row.', 'Registros anteriores por verificar ·': 'Earlier records to verify ·',
  'Pendiente de identificar al contacto comercial.': 'The commercial contact is still to be identified.', 'Aún no hay referencias comprobadas para este punto.': 'There are no verified items for this point yet.', 'Faltan sucursales y su surtido por tienda.': 'Branches and their assortment by store are missing.',
  'Cadena / cuenta': 'Chain / account', 'Canal': 'Channel', 'Contacto vinculado': 'Linked contact', 'Cuenta en investigación · proveedor por verificar': 'Account under research · supplier to be verified', 'Distribución confirmada': 'Confirmed distribution',
  'Distribuidor': 'Distributor', 'Empaque': 'Packaging', 'Línea': 'Line', 'Línea documentada': 'Documented line', 'Línea publicada en catálogo': 'Line listed in catalog', 'Marca': 'Brand', 'Marca documentada': 'Documented brand', 'Mercado': 'Market',
  'Mercado documentado': 'Documented market', 'Proyecto': 'Project', 'Punto de atención': 'Service point', 'Referencia de catálogo': 'Catalog item', 'Relación histórica · otras marcas': 'Historical relationship · other brands', 'Retailer': 'Retailer',
  'Contactos del distribuidor': 'Distributor contacts', 'Conectividades del contacto': 'Contact connections', 'Contactos': 'Contacts', 'Conectividades': 'Connections', 'Aún no hay personas de contacto vinculadas.': 'There are no linked contact people yet.',
  'Conexiones del portafolio': 'Portfolio connections', 'Conexiones de': 'Connections of', 'Empresa': 'Company', 'Distribución': 'Distribution', 'Presentaciones': 'Presentations', 'Sabores': 'Flavors',
};
export function useConnT() {
  const { lang, locale } = useUiLang();
  const T = useCallback((es: string) => (lang === 'en' ? CONN_EN[es] ?? es : es), [lang]);
  return { T, lang, locale };
}
