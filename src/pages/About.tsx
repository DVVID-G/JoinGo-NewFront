import { Video, Users, Globe, Shield, Heart, Zap } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

const values = [
  {
    icon: Users,
    title: 'Colaboración',
    description: 'Creemos que la comunicación efectiva es la base de cualquier equipo exitoso.',
  },
  {
    icon: Shield,
    title: 'Seguridad',
    description: 'Tu privacidad es nuestra prioridad. Implementamos las mejores prácticas de seguridad.',
  },
  {
    icon: Zap,
    title: 'Simplicidad',
    description: 'Diseñamos herramientas intuitivas que cualquiera puede usar sin complicaciones.',
  },
  {
    icon: Globe,
    title: 'Accesibilidad',
    description: 'Construimos productos inclusivos que funcionan para todos, en cualquier lugar.',
  },
];

const team = [
  { name: 'David Giraldo', role: 'Fullstack Developer', initials: 'DG' },
];

export default function About() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-background to-muted/30 py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="animate-slide-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Sobre <span className="gradient-text">JoinGo</span>
            </h1>
            <p className="mt-6 animate-slide-up text-lg text-muted-foreground [animation-delay:100ms]">
              Somos un equipo apasionado por conectar personas y facilitar la colaboración
              a través de tecnología de videoconferencias de alta calidad.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20" aria-labelledby="mission-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                <Video className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
              </div>
            </div>
            <h2 id="mission-heading" className="mt-8 text-center text-3xl font-bold text-foreground">
              Nuestra misión
            </h2>
            <p className="mt-4 text-center text-lg text-muted-foreground">
              Hacer que la comunicación remota sea tan natural y efectiva como estar en la misma
              habitación. Creemos que la distancia no debería ser una barrera para la colaboración,
              y trabajamos cada día para eliminar esa brecha.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-muted/30 py-20" aria-labelledby="values-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 id="values-heading" className="text-center text-3xl font-bold text-foreground">
            Nuestros valores
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => (
              <div
                key={value.title}
                className="card-elevated animate-slide-up p-6 text-center"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <value.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{value.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20" aria-labelledby="team-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 id="team-heading" className="text-center text-3xl font-bold text-foreground">
            Nuestro equipo
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Las personas detrás de JoinGo
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member, index) => (
              <div
                key={member.name}
                className="animate-slide-up text-center"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {member.initials}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary py-20" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4 text-center lg:px-8">
          <Heart className="mx-auto h-12 w-12 text-accent" aria-hidden="true" />
          <h2 id="cta-heading" className="mt-4 text-2xl font-bold text-secondary-foreground">
            ¿Listo para unirte a nosotros?
          </h2>
          <p className="mt-2 text-secondary-foreground/80">
            Comienza a conectar con tu equipo hoy mismo
          </p>
        </div>
      </section>
    </Layout>
  );
}
