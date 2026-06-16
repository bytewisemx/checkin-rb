export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CheckinRB App/1.0',
          'Accept-Language': 'es'
        }
      }
    );
    
    if (!response.ok) throw new Error('Network error');
    
    const data = await response.json();
    
    if (data && data.address) {
      // Intentar construir una dirección corta (calle + número o barrio)
      const road = data.address.road || '';
      const houseNumber = data.address.house_number || '';
      const suburb = data.address.suburb || data.address.neighbourhood || '';
      const city = data.address.city || data.address.town || data.address.village || '';
      
      if (road) {
        return `Cerca de ${road} ${houseNumber}`.trim();
      } else if (suburb) {
        return `Zona ${suburb}, ${city}`;
      } else if (city) {
        return city;
      }
      
      return data.display_name.split(',').slice(0, 2).join(','); // Fallback corto
    }
    
    return 'Ubicación desconocida';
  } catch (error) {
    console.error('Error fetching address:', error);
    return 'Ubicación aproximada (Sin conexión a mapas)';
  }
}
