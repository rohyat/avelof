export const business = {
  name: 'AVELOF',
  website: 'https://www.avelof.in',
  email: 'info@avelof.in',
  instagram: 'https://www.instagram.com/avelof.in/',
  instagramHandle: '@avelof.in',
  facebook: 'https://www.facebook.com/avelof.in',
  phone: '+91 914-941-8161',
  destination: 'Kashmir, India',
}

export const itineraryContact = {
  name: 'Mr. Rohyat Naik',
  phone: business.phone.replace(/\D/g, '').slice(-10),
}