// TourPackageSchema.tsx - Generates JSON-LD schema for tour packages
import { useEffect } from 'react'

interface TourPackageSchemaData {
  id: string
  name: string
  description: string
  price: number
  duration: string
  location: string
  hotelStandard?: string
  transport?: string
  includes?: string[]
}

interface TourPackageSchemaProps {
  packages: TourPackageSchemaData[]
}

export default function TourPackageSchema({ packages }: TourPackageSchemaProps) {
  useEffect(() => {
    // Create schema for each tour package
    packages.forEach((pkg) => {
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'TourPackage',
        name: pkg.name,
        description: pkg.description,
        priceCurrency: 'INR',
        price: pkg.price.toString(),
        duration: convertDurationToISO(pkg.duration),
        areaServed: {
          '@type': 'Place',
          name: pkg.location,
        },
        includedInPackage: pkg.includes?.map((item) => ({
          '@type': 'Service',
          name: item,
        })) || [],
        provider: {
          '@type': 'Organization',
          name: 'AVELOF',
          url: 'https://avelof.pages.dev',
        },
        url: `https://avelof.pages.dev/tour-packages#${pkg.id}`,
      }

      // Add or update schema tag
      let script = document.querySelector(`script[type="application/ld+json"][data-package="${pkg.id}"]`) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.setAttribute('data-package', pkg.id)
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(schema)
    })

    return () => {
      // Cleanup is handled by component unmount
    }
  }, [packages])

  return null
}

// Helper to convert "X nights · Y days" to ISO 8601 duration
function convertDurationToISO(duration: string): string {
  const match = duration.match(/(\d+)\s*nights?\s*·\s*(\d+)\s*days?/i)
  if (!match) return 'P5D'
  const days = parseInt(match[2])
  return `P${days}D`
}
