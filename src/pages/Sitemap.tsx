import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Map, Home, Video, User, Info, HelpCircle, LogIn, UserPlus } from 'lucide-react';

const sitemapSections = [
  {
    title: 'Principal',
    links: [
      { name: 'Inicio', href: '/', icon: Home },
      { name: 'Dashboard', href: '/dashboard', icon: Video },
    ],
  },
  {
    title: 'Cuenta',
    links: [
      { name: 'Iniciar sesión', href: '/login', icon: LogIn },
      { name: 'Registrarse', href: '/register', icon: UserPlus },
      { name: 'Mi perfil', href: '/profile', icon: User },
    ],
  },
  {
    title: 'Información',
    links: [
      { name: 'Sobre nosotros', href: '/about', icon: Info },
      { name: 'Preguntas frecuentes', href: '/faq', icon: HelpCircle },
      { name: 'Mapa del sitio', href: '/sitemap', icon: Map },
    ],
  },
];

export default function Sitemap() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-background to-muted/30 py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Map className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h1 className="animate-slide-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Mapa del sitio
            </h1>
            <p className="mt-4 animate-slide-up text-lg text-muted-foreground [animation-delay:100ms]">
              Encuentra fácilmente todas las secciones de JoinGo
            </p>
          </div>
        </div>
      </section>

      {/* Sitemap content */}
      <section className="py-20" aria-labelledby="sitemap-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 id="sitemap-heading" className="sr-only">Secciones del sitio</h2>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {sitemapSections.map((section, sectionIndex) => (
              <div
                key={section.title}
                className="animate-slide-up"
                style={{ animationDelay: `${sectionIndex * 100}ms` }}
              >
                <h3 className="mb-4 text-lg font-semibold text-foreground">{section.title}</h3>
                <ul className="space-y-3" role="list">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.href}
                        className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <link.icon className="h-4 w-4" aria-hidden="true" />
                        <span className="link-underline">{link.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
