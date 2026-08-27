const fs = require('fs');
const content = fs.readFileSync('src/pages/admin/AdminConfig.tsx', 'utf8');

const oldFunc = `  const handleImportBusinesses = async () => {
    let rawResults = searchResult?.local_results || searchResult?.places_results;
    let results: any[] = [];
    if (Array.isArray(rawResults)) {
      results = rawResults;
    } else if (rawResults && Array.isArray(rawResults.places)) {
      results = rawResults.places;
    } else if (rawResults && typeof rawResults === 'object') {
      results = [rawResults];
    }

    if (results.length === 0) {
      setImportMessage({ type: 'error', text: 'No se encontraron resultados locales (local_results / places_results) válidos para importar en este JSON. Intenta añadir "en Vigo" a tu búsqueda.' });
      return;
    }
    
    setIsImporting(true);
    setImportMessage(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No estás autenticado o la sesión expiró.");
      }

      const businessesToInsert = results.map((place: any) => ({
        name: place.title || 'Negocio Desconocido',
        description: place.type || place.description || '',
        address: place.address || '',
        phone: place.phone || '',
        website: place.links?.website || place.website || '',
        latitude: place.gps_coordinates?.latitude || null,
        longitude: place.gps_coordinates?.longitude || null,
        opening_hours: place.operating_hours || {},
        is_active: true,
        owner_id: user.id
      }));

      const { error } = await supabase
        .from('businesses')
        .insert(businessesToInsert);

      if (error) throw error;
      
      setImportMessage({ type: 'success', text: \`¡Se han importado \${businessesToInsert.length} negocios correctamente!\` });
    } catch (err: any) {
      console.error("Error importando:", err);
      setImportMessage({ type: 'error', text: \`Error: \${err.message}\` });
    } finally {
      setIsImporting(false);
    }
  };`;

const newFunc = `  const handleImportBusinesses = async () => {
    let rawResults = searchResult?.local_results || searchResult?.places_results;
    let results: any[] = [];
    if (Array.isArray(rawResults)) {
      results = rawResults;
    } else if (rawResults && Array.isArray(rawResults.places)) {
      results = rawResults.places;
    } else if (rawResults && typeof rawResults === 'object') {
      results = [rawResults];
    }

    if (results.length === 0) {
      setImportMessage({ type: 'error', text: 'No se encontraron resultados locales (local_results / places_results) válidos para importar en este JSON. Intenta añadir "en Vigo" a tu búsqueda.' });
      return;
    }
    
    setIsImporting(true);
    setImportMessage(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No estás autenticado o la sesión expiró.");
      }

      // Check existing businesses to prevent duplicates
      const { data: existingBusinesses } = await supabase
        .from('businesses')
        .select('name, address');
        
      const existingNames = new Set((existingBusinesses || []).map(b => b.name.toLowerCase().trim()));

      let dupCount = 0;
      const businessesToInsert = [];

      for (const place of results) {
        const placeName = (place.title || 'Negocio Desconocido').trim();
        const placeNameLower = placeName.toLowerCase();
        
        if (existingNames.has(placeNameLower)) {
          dupCount++;
          continue;
        }
        
        existingNames.add(placeNameLower); // pre-empt duplicate inserts in the same batch
        
        businessesToInsert.push({
          name: placeName,
          description: place.type || place.description || place.types?.join(', ') || '',
          address: place.address || '',
          phone: place.phone || '',
          website: place.links?.website || place.website || '',
          latitude: place.gps_coordinates?.latitude || null,
          longitude: place.gps_coordinates?.longitude || null,
          opening_hours: place.operating_hours || place.hours || {},
          is_active: true,
          owner_id: user.id
        });
      }

      if (businessesToInsert.length > 0) {
        const { error } = await supabase
          .from('businesses')
          .insert(businessesToInsert);
        if (error) throw error;
      }
      
      setImportMessage({ 
        type: 'success', 
        text: \`Importación completada: \${businessesToInsert.length} nuevos negocios insertados, \${dupCount} duplicados omitidos.\` 
      });
    } catch (err: any) {
      console.error("Error importando:", err);
      setImportMessage({ type: 'error', text: \`Error: \${err.message}\` });
    } finally {
      setIsImporting(false);
    }
  };`;

const newContent = content.replace(oldFunc, newFunc);
fs.writeFileSync('src/pages/admin/AdminConfig.tsx', newContent);
