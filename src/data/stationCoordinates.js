export const stationCoordinatesByCity = {
  "Lahore": {
    "Safari Park-LHR": { lat: 31.382314774885888, lng: 74.21817281534902 },
    "Kahna Nau Hospital-LHR": { lat: 31.370968642952125, lng: 74.36509796071374 },
    "PKLI-LHR": { lat: 31.455944217196357, lng: 74.4637726464879 },
    "FMDRC-LHR": { lat: 31.535903137206997, lng: 74.43518804649057 },
    "UET-LHR": { lat: 31.579825674297712, lng: 74.35500334094795 },
    "LWMC-LHR": { lat: 31.463797290721757, lng: 74.22594175216207 },
    "Punjab University-LHR": { lat: 31.47965946421483, lng: 74.26608653889994 },
    "Govt. Teaching Hospital Shahdara-LHR": { lat: 31.638126385663895, lng: 74.28518245233634 }
  },
  "Sheikhupura": {
    "DHQ Sheikhupura": { lat: 31.711907268506444, lng: 73.97887262744989 },
  },
  "Mobile AQMS": {
    "Raja Jang Kasur - Mobile 1": { lat: 31.22242652245513, lng: 74.25888348097924 },
    "Lathepur LHR - Mobile 2": { lat: 31.717597503919553, lng: 74.38945645216268 },
    "Wagha Border LHR - Mobile 3": { lat: 31.60217088224592, lng: 74.54493878284885 },
    "Egerton Road - Mobile 4": { lat: 31.560766512188792, lng: 74.33078657301355 },
    "BHU Jandiala Kalsan LHR - Mobile 5": { lat: 31.84868154529122, lng: 74.51479796751337 }
  },
  "Faisalabad": {
    "DC Office Faisalabad": { lat: 31.425448762788633, lng: 73.08115579440872 },
    "GCU Faisalabad": { lat: 31.416246064561182, lng: 73.07000252883559 },
    "NTU Faisalabad": { lat: 31.462112827887097, lng: 73.14854729999999 }
  },
  "Gujranwala": {
    "GCW Gujranwala": { lat: 32.25587012731105, lng: 74.15945324463222 },
    "DC Office Gujranwala": { lat: 32.17468001795155, lng: 74.19513105997787 }
  },
  "Multan": {
    "BZU Multan": { lat: 30.262345863388603, lng: 71.51253806752977 },
    "M. Nawaz Sharif University of Engineering & Technology Multan": { lat: 30.029109580383068, lng: 71.54151150235819 }
  },
  "Bahawalpur": {
    "IUB (Baghdad Campus) Bahawalpur": { lat: 29.376832580609566, lng: 71.76267240237333 },
    "IUB (Khawaja Fareed Campus) Bahawalpur": { lat: 29.397708118736162, lng: 71.69163577353685 }
  },
  "Sargodha": {
    "DC Office Sargodha": { lat: 32.07161053848134, lng: 72.67279475998042 },
    "BISE Sargodha": { lat: 32.0355877857731, lng: 72.70063274138406 }
  },
  "Sialkot": {
    "DC Office Sialkot": { lat: 32.50525590601202, lng: 74.53303397614911 }
  },
  "Kasur": {
    "DC Office Kasur": { lat: 31.11611, lng: 74.46725 }
  },
  "Narowal": {
    "DC Office Narowal": { lat: 32.09704, lng: 74.89411 }
  },
  "Hafizabad": {
    "DC Office Hafizabad": { lat: 32.07171, lng: 73.71436 }
  },
  "Gujrat": {
    "DC Office Gujrat": { lat: 32.58559, lng: 74.07833 }
  },
  "Chakwal": {
    "DC Office Chakwal": { lat: 32.92564, lng: 72.80549 }
  },
  "Khanewal": {
    "DC Office Khanewal": { lat: 30.30231, lng: 71.92921 }
  },
  "Muzaffargarh": {
    "DC Office Muzaffargarh": { lat: 30.07608, lng: 71.19038 }
  },
  "Rahim Yar Khan": {
    "DC Office Rahim Yar Khan": { lat: 28.42323, lng: 70.31827 }
  },
  "DG Khan": {
    "DC Office DG Khan": { lat: 30.051792633623844, lng: 70.62966164154528 }
  },
  "Rawalpindi": {
    "DC Office Rawalpindi": { lat: 33.58462459856753, lng: 73.06891569999999 },
    "ARID University Rawalpindi": { lat: 33.65061773446243, lng: 73.08067117116441 },
    "Drug Testing Laboratory Rawalpindi": { lat: 33.54226391435295, lng: 73.01392021534237 }
  }
};

// Helper to derive backend canonical ID from a display key
// For Mobile AQMS, extract the trailing "Mobile N" token; otherwise keep as-is
const deriveCanonicalId = (cityName, stationKey) => {
  if (cityName === "Mobile AQMS") {
    const match = stationKey.match(/Mobile\s*\d+/i);
    if (match) {
      // Normalize spacing/case: "Mobile 1"
      const id = match[0]
        .replace(/\s+/g, " ")
        .replace(/\bmobile\b/i, "Mobile");
      return id;
    }
  }
  return stationKey;
};

// Maps for backend ID -> position, label, and city
export const stationIdToPosition = {};
export const stationIdToLabel = {};
export const stationIdToCity = {};

for (const [cityName, stations] of Object.entries(stationCoordinatesByCity)) {
  for (const [stationKey, position] of Object.entries(stations)) {
    const id = deriveCanonicalId(cityName, stationKey);
    stationIdToPosition[id] = position;
    stationIdToLabel[id] = stationKey; // Display label is the key as defined in data
    stationIdToCity[id] = cityName;
  }
}

// Backwards-compatible export used by existing code (ID -> position)
export const stationCoordinates = stationIdToPosition;
