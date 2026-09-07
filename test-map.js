const apiKey = process.env.GOOGLE_MAPS_API_KEY;
const lat = 42.23282; // Vigo lat
const lng = -8.72264; // Vigo lng
const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=600x600&maptype=satellite&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
console.log(url);
