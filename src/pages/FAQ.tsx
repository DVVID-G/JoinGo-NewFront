import { Layout } from '@/components/layout/Layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: '¿Cómo creo una reunión?',
    answer:
      'Para crear una reunión, inicia sesión en tu cuenta y ve al Dashboard. Haz clic en "Crear nueva reunión" y se generará un código único. Comparte este código con los participantes para que puedan unirse.',
  },
  {
    question: '¿Cómo me uno a una reunión existente?',
    answer:
      'Para unirte a una reunión, necesitas el código de reunión proporcionado por el organizador. Ve al Dashboard, ingresa el código en el campo "Código de reunión" y haz clic en "Unirse a la reunión".',
  },
  {
    question: '¿Cuántos participantes pueden unirse a una reunión?',
    answer:
      'Actualmente, JoinGo soporta hasta 100 participantes por reunión. Si necesitas más capacidad, contáctanos para conocer nuestros planes empresariales.',
  },
  {
    question: '¿Las reuniones son seguras?',
    answer:
      'Sí, todas las reuniones en JoinGo están protegidas con encriptación de extremo a extremo. Además, cada reunión tiene un código único que solo los invitados conocen.',
  },
  {
    question: '¿Puedo grabar las reuniones?',
    answer:
      'La función de grabación está disponible en nuestros planes premium. Los participantes serán notificados cuando una reunión esté siendo grabada.',
  },
  {
    question: '¿Funciona en dispositivos móviles?',
    answer:
      'Sí, JoinGo está optimizado para funcionar en cualquier dispositivo con un navegador moderno. No necesitas instalar ninguna aplicación.',
  },
  {
    question: '¿Cómo puedo compartir mi pantalla?',
    answer:
      'Durante una reunión, encontrarás el botón "Compartir pantalla" en la barra de controles. Puedes elegir compartir toda la pantalla, una ventana específica o una pestaña del navegador.',
  },
  {
    question: '¿Hay un límite de tiempo para las reuniones?',
    answer:
      'Las reuniones gratuitas tienen un límite de 60 minutos. Con una cuenta premium, las reuniones pueden durar hasta 24 horas sin interrupciones.',
  },
  {
    question: '¿Cómo elimino mi cuenta?',
    answer:
      'Puedes eliminar tu cuenta desde la página de perfil. Ve a "Mi perfil" y encontrarás la opción "Eliminar mi cuenta" en la zona de peligro. Ten en cuenta que esta acción es irreversible.',
  },
  {
    question: '¿Cómo contacto al soporte técnico?',
    answer:
      'Puedes contactarnos enviando un correo a support@joingo.com o a través del chat de soporte disponible en la aplicación. Nuestro equipo responde en menos de 24 horas.',
  },
];

export default function FAQ() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-background to-muted/30 py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <HelpCircle className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h1 className="animate-slide-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Preguntas frecuentes
            </h1>
            <p className="mt-4 animate-slide-up text-lg text-muted-foreground [animation-delay:100ms]">
              Encuentra respuestas a las preguntas más comunes sobre JoinGo
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-20" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-heading" className="sr-only">Lista de preguntas frecuentes</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-b border-border">
                  <AccordionTrigger className="text-left text-foreground hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-muted/30 py-16" aria-labelledby="contact-heading">
        <div className="container mx-auto px-4 text-center lg:px-8">
          <h2 id="contact-heading" className="text-2xl font-bold text-foreground">
            ¿No encontraste lo que buscabas?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Contáctanos en{' '}
            <a href="mailto:support@joingo.com" className="text-primary hover:underline">
              support@joingo.com
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
