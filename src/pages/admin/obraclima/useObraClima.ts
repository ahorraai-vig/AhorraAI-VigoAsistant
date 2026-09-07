import { useState, useEffect } from 'react';
import { adminFetch } from '../../../lib/apiAuth';

export function useObraClima() {
  const [config, setConfig] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [conf, cli, cat, bud, inv] = await Promise.all([
        adminFetch('/api/obraclima/config').then(r => r.json()),
        adminFetch('/api/obraclima/clients').then(r => r.json()),
        adminFetch('/api/obraclima/catalog').then(r => r.json()),
        adminFetch('/api/obraclima/budgets').then(r => r.json()),
        adminFetch('/api/obraclima/invoices').then(r => r.json()),
      ]);
      setConfig(conf);
      setClients(cli);
      setCatalog(cat);
      setBudgets(bud);
      setInvoices(inv);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return { config, clients, catalog, budgets, invoices, refresh: fetchData, loading };
}
