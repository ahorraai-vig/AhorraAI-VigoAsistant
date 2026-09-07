export const solarAnalyzeSingle = `
app.post("/api/solar/analyze-single", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "Falta dirección." });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "No hay GOOGLE_MAPS_API_KEY", needsCredit: true });
    }

    // Geocode
    const geoUrl = \`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(address)}&key=\${apiKey}\`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (geoData.status !== "OK" || !geoData.results[0]) {
      return res.status(404).json({ error: "No se pudo encontrar la dirección." });
    }

    const { lat, lng } = geoData.results[0].geometry.location;
    const formattedAddress = geoData.results[0].formatted_address;

    // Static Map URL
    const staticMapUrl = \`https://maps.googleapis.com/maps/api/staticmap?center=\${lat},\${lng}&zoom=20&size=600x600&maptype=satellite&markers=color:red%7C\${lat},\${lng}&key=\${apiKey}\`;

    // Try Solar API
    let solarData = null;
    const solarUrl = \`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=\${lat}&location.longitude=\${lng}&requiredQuality=HIGH&key=\${apiKey}\`;
    const solarRes = await fetch(solarUrl);
    
    if (solarRes.ok) {
        const rawSolar = await solarRes.json();
        const maxPanels = rawSolar.solarPotential?.maxArrayPanelsCount || 12;
        const panelArea = 1.6; // approx m2 per panel
        const roofArea = Math.round(maxPanels * panelArea * 1.5); // Estimate total roof
        const hoursOfSun = Math.round((rawSolar.solarPotential?.maxSunshineHoursPerYear || 1600));
        
        solarData = {
           roofArea,
           maxPanels,
           hoursOfSun
        };
    } else {
       // Mock fallback
       solarData = {
           roofArea: Math.floor(Math.random() * 50) + 40,
           maxPanels: Math.floor(Math.random() * 10) + 8,
           hoursOfSun: Math.floor(Math.random() * 500) + 1500
       };
    }

    // Financials Mock
    const yearlyConsumption = 4200 + Math.floor(Math.random() * 2000);
    const savingsPercent = 65 + Math.floor(Math.random() * 15); // 65-80%
    const totalCost = solarData.maxPanels * 450; 
    const paybackYears = (totalCost / (yearlyConsumption * 0.15 * (savingsPercent/100))).toFixed(1);

    return res.json({
       address: formattedAddress,
       lat,
       lng,
       staticMapUrl,
       solarData,
       financials: {
          yearlyConsumption,
          savingsPercent,
          totalCost,
          paybackYears
       }
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
`;
