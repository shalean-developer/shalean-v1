export type CleanerProfile = {
  id: string;
  name: string;
  photoUrl: string;
  rating: number;
  reviews: number;
  experience: string;
  specialties: string[];
  availableSuburbs: string[];
  available: boolean;
  equipmentEligible: boolean;
};

export const cleanerProfiles: CleanerProfile[] = [
  {
    id: "cleaner-nandi",
    name: "Nandi M.",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    rating: 4.9,
    reviews: 128,
    experience: "4 years",
    specialties: ["Recurring homes", "Ironing", "Interior windows"],
    availableSuburbs: ["Sea Point", "Green Point", "Claremont", "Newlands"],
    available: true,
    equipmentEligible: true,
  },
  {
    id: "cleaner-thabo",
    name: "Thabo K.",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    rating: 4.8,
    reviews: 94,
    experience: "3 years",
    specialties: ["Large homes", "Cabinets", "Walls"],
    availableSuburbs: ["Sea Point", "Rondebosch", "Woodstock", "Observatory"],
    available: true,
    equipmentEligible: true,
  },
  {
    id: "cleaner-amara",
    name: "Amara S.",
    photoUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=240&q=80",
    rating: 4.7,
    reviews: 76,
    experience: "2 years",
    specialties: ["Apartment resets", "Fridge", "Laundry"],
    availableSuburbs: ["Camps Bay", "Sea Point", "Century City", "Bloubergstrand"],
    available: true,
    equipmentEligible: false,
  },
  {
    id: "cleaner-zanele",
    name: "Zanele P.",
    photoUrl: "https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&w=240&q=80",
    rating: 4.9,
    reviews: 142,
    experience: "5 years",
    specialties: ["Premium homes", "Oven", "Deep detail"],
    availableSuburbs: ["Durbanville", "Bellville", "Claremont", "Newlands"],
    available: false,
    equipmentEligible: true,
  },
];

export function getAvailableCleaners(suburb: string) {
  return cleanerProfiles.map((cleaner) => ({
    ...cleaner,
    available: cleaner.available && cleaner.availableSuburbs.includes(suburb),
  }));
}

export function getCleanerById(id: string) {
  return cleanerProfiles.find((cleaner) => cleaner.id === id);
}
