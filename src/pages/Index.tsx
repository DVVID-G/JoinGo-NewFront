import { Link } from 'react-router-dom';
import { Video, Users, Shield, Zap, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';

const features = [
  {
    icon: Video,
    title: 'Videoconferencias HD',
    description: 'Calidad de video y audio cristalina para todas tus reuniones.',
  },
  {
    icon: Users,
    title: 'Fácil de usar',
    description: 'Únete o crea reuniones en segundos con un simple código.',
  },
  {
    icon: Shield,
    title: 'Seguro y privado',
    description: 'Encriptación de extremo a extremo para proteger tus conversaciones.',
  },
  {
    icon: Zap,
    title: 'Chat integrado',
    description: 'Comunícate por chat mientras estás en la videollamada.',
  },
];

export default function Index() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="animate-slide-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Conecta con tu equipo{' '}
              <span className="gradient-text">en cualquier lugar</span>
            </h1>
            <p className="mt-6 animate-slide-up text-lg text-muted-foreground [animation-delay:100ms]">
              JoinGo es la plataforma de videoconferencias más sencilla y segura. 
              Crea reuniones instantáneas o únete con un código en segundos.
            </p>
            <div className="mt-10 flex animate-slide-up flex-col items-center justify-center gap-4 [animation-delay:200ms] sm:flex-row">
              {isAuthenticated ? (
                <Button asChild size="lg" className="btn-gradient w-full sm:w-auto">
                  <Link to="/dashboard">
                    Ir al dashboard
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="btn-gradient w-full sm:w-auto">
                    <Link to="/register">
                      Comenzar gratis
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Link to="/login">Ya tengo cuenta</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" aria-hidden="true" />
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32" aria-labelledby="features-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Todo lo que necesitas para tus reuniones
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Herramientas poderosas para comunicarte de manera efectiva
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="card-elevated animate-slide-up p-6"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-secondary py-20" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="cta-heading" className="text-3xl font-bold tracking-tight text-secondary-foreground sm:text-4xl">
              {isAuthenticated ? 'Continúa tus reuniones' : '¿Listo para empezar?'}
            </h2>
            <p className="mt-4 text-lg text-secondary-foreground">
              {isAuthenticated
                ? 'Regresa a tu panel y únete a tu próxima reunión en segundos.'
                : 'Crea tu cuenta gratuita y comienza a conectar con tu equipo hoy mismo.'}
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="btn-accent">
                <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                  {isAuthenticated ? 'Ir al dashboard' : 'Crear cuenta gratis'}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
