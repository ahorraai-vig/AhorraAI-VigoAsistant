sed -i 's/const staticMapUrl = .*/const staticMapUrl = `https:\/\/www.google.com\/maps\/embed\/v1\/view?key=${apiKey}\\&center=${lat},${lng}\\&zoom=20\\&maptype=satellite`;/g' api/index.ts
