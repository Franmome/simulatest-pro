// frontend/src/pages/InicioPublico.jsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function InicioPublico() {
  const navigate = useNavigate()
  const observerRef = useRef(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Función para scroll suave con offset para navbar fijo (altura aprox 80px)
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 80
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      const offsetPosition = elementPosition - offset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
    setMobileMenuOpen(false)
  }

  // Scroll al inicio (top) para botón "Inicio"
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  // Animaciones al hacer scroll (fade-in + slide-up)
  useEffect(() => {
    const animatedElements = document.querySelectorAll('.animate-on-scroll')
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    animatedElements.forEach(el => observer.observe(el))
    observerRef.current = observer

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  // Convocatorias destacadas (solo visuales, no clickeables)
  const convocatoriasDestacadas = [
    { nombre: 'CNSC', color: 'bg-primary/10 text-primary' },
    { nombre: 'Contraloría', color: 'bg-slate-100 text-slate-700' },
    { nombre: 'Procuraduría', color: 'bg-blue-50 text-blue-700' },
    { nombre: 'ICFES', color: 'bg-tertiary-container/20 text-tertiary' },
    { nombre: 'Saber Pro', color: 'bg-secondary-container/20 text-on-secondary-container' },
  ]

  return (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Estilos globales para animaciones */}
      <style>{`
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(1.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-gradient {
          background: radial-gradient(circle at top right, #dae2ff 0%, #f8f9fa 50%);
        }
        .text-gradient {
          background: linear-gradient(135deg, #003d9b 0%, #0052cc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .animate-on-scroll {
          opacity: 0;
          transform: translateY(1.5rem);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .animate-fade-in-up {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      `}</style>

      {/* Navbar fijo */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">school</span>
            <span className="text-2xl font-black text-primary tracking-tighter">PRAXIA</span>
          </div>
          
          {/* Menú desktop - solo Inicio y Cómo funciona */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={scrollToTop} className="text-primary font-bold hover:underline underline-offset-4">Inicio</button>
            <button onClick={() => scrollToSection('como-funciona')} className="text-slate-600 hover:text-primary transition-colors px-3 py-1 rounded-lg hover:bg-primary/5">Cómo funciona</button>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/login')} className="hidden md:block font-semibold text-primary hover:underline underline-offset-4">Iniciar sesión</button>
            <button onClick={() => navigate('/registro')} className="hidden md:block bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-transform shadow-md shadow-primary/20">Crear cuenta</button>
            
            {/* Botón menú móvil */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-surface-container-high">
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {/* Menú móvil desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-lg animate-fade-in-up">
            <div className="flex flex-col p-4 gap-3">
              <button onClick={scrollToTop} className="text-left px-4 py-3 rounded-lg hover:bg-surface-container-high font-medium">Inicio</button>
              <button onClick={() => scrollToSection('como-funciona')} className="text-left px-4 py-3 rounded-lg hover:bg-surface-container-high font-medium">Cómo funciona</button>
              <div className="border-t border-slate-200 my-2"></div>
              <button onClick={() => { navigate('/login'); setMobileMenuOpen(false); }} className="text-left px-4 py-3 rounded-lg hover:bg-surface-container-high font-medium text-primary">Iniciar sesión</button>
              <button onClick={() => { navigate('/registro'); setMobileMenuOpen(false); }} className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold text-center active:scale-95 transition-transform shadow-md">Crear cuenta</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Solo botones de autenticación */}
      <header className="relative pt-32 pb-20 hero-gradient overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 animate-on-scroll">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight text-on-surface">
              Prepárate con <span className="text-gradient">simulacros diseñados para convocatorias reales</span>
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant mb-10 max-w-xl leading-relaxed">
              Estudia, practica y mide tu rendimiento en un solo lugar. Simulacros por convocatoria, niveles de dificultad y material de estudio enfocado en las pruebas del Estado Colombiano.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => navigate('/login')} className="bg-primary text-on-primary px-8 py-4 rounded-full font-bold text-lg hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95">
                Iniciar sesión
              </button>
              <button onClick={() => navigate('/registro')} className="bg-surface-container-highest text-on-surface px-8 py-4 rounded-full font-bold text-lg hover:bg-surface-container-high transition-all active:scale-95">
                Crear cuenta
              </button>
            </div>
          </div>
          <div className="relative lg:h-[500px] flex items-center justify-center animate-on-scroll">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl" />
            {/* Mockup visual tipo dashboard */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 transform lg:rotate-2 hover:rotate-0 transition-transform duration-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <div className="ml-auto text-xs font-medium text-slate-400">Dashboard</div>
              </div>
              <div className="space-y-3">
                <div className="h-8 bg-gradient-to-r from-primary/20 to-primary/5 rounded-lg w-3/4"></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-20 bg-slate-100 rounded-lg"></div>
                  <div className="h-20 bg-slate-100 rounded-lg"></div>
                  <div className="h-20 bg-slate-100 rounded-lg"></div>
                </div>
                <div className="h-32 bg-gradient-to-b from-primary/10 to-transparent rounded-lg"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-slate-100 rounded-full w-1/4"></div>
                  <div className="h-8 bg-slate-100 rounded-full w-1/4"></div>
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 bg-white p-3 rounded-xl shadow-lg border border-slate-100">
                <span className="text-xs font-bold text-primary">Tu progreso →</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Franja de valor (badges) debajo del hero */}
      <div className="max-w-7xl mx-auto px-6 pb-8 -mt-4 animate-on-scroll">
        <div className="flex flex-wrap justify-center gap-3">
          {['Simulacros por convocatoria', 'Material de estudio', 'Resultados en tiempo real', 'Experiencia tipo examen'].map((item, idx) => (
            <span key={idx} className="bg-surface-container-high/80 backdrop-blur-sm text-on-surface-variant px-5 py-2 rounded-full text-sm font-medium shadow-sm">{item}</span>
          ))}
        </div>
      </div>

      {/* Sección: Qué encontrarás dentro de Praxia */}
      <section className="py-24 bg-surface" id="que-encontraras">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4">Qué encontrarás dentro de Praxia</h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">Herramientas diseñadas para que te prepares de manera efectiva y conozcas tu nivel real.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: 'quiz', title: 'Simulacros por convocatoria', desc: 'Pruebas que replican la estructura y nivel de exigencia de CNSC, ICFES, y otras entidades del Estado.' },
              { icon: 'insights', title: 'Resultados y métricas', desc: 'Visualiza tu progreso, identifica áreas de mejora y compara tu desempeño con el promedio.' },
              { icon: 'bar_chart_4_bars', title: 'Práctica por niveles', desc: 'Desde nivel básico hasta avanzado, para que avances a tu propio ritmo.' },
              { icon: 'library_books', title: 'Material de estudio', desc: 'Guías, explicaciones y recursos descargables alineados con los temarios oficiales.' }
            ].map((item, idx) => (
              <div key={idx} className="glass-card p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-white/40 animate-on-scroll" style={{ transitionDelay: `${idx * 100}ms` }}>
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-24 bg-surface-container-low" id="como-funciona">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4">Cómo funciona</h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">Tres pasos para empezar a mejorar tu preparación.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-12">
            {[
              { step: 1, icon: 'ads_click', title: 'Elige tu convocatoria', desc: 'Selecciona entre CNSC, ICFES Saber 11, TyT, o concursos específicos del Estado.' },
              { step: 2, icon: 'exercise', title: 'Practica sin límites', desc: 'Realiza simulacros, revisa explicaciones y estudia con material enfocado.' },
              { step: 3, icon: 'emoji_events', title: 'Mide tu avance', desc: 'Revisa tus estadísticas y asegura que llegas con confianza al examen real.' }
            ].map((item, idx) => (
              <div key={idx} className="text-center px-6 animate-on-scroll" style={{ transitionDelay: `${idx * 150}ms` }}>
                <div className="relative inline-block mb-8">
                  <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-2xl">
                    <span className="material-symbols-outlined text-4xl">{item.icon}</span>
                  </div>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-primary rounded-full flex items-center justify-center font-bold text-primary">{item.step}</div>
                </div>
                <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                <p className="text-on-surface-variant">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección: Explora la plataforma */}
      <section className="py-24 bg-surface overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4">Explora la plataforma</h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">Conoce de cerca cómo te ayudamos a prepararte para tu prueba.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: 'quiz', title: 'Vista de simulacro', desc: 'Interfaz limpia con temporizador, navegación entre preguntas y guardado automático.' },
              { icon: 'bar_chart', title: 'Resultados detallados', desc: 'Desglose por competencia, comparativa y recomendaciones personalizadas.' },
              { icon: 'menu_book', title: 'Material de estudio', desc: 'Accede a guías, videoclases y documentos organizados por temática.' }
            ].map((item, idx) => (
              <div key={idx} className="bg-surface-container-low p-6 rounded-2xl shadow-md hover:shadow-lg transition-all animate-on-scroll" style={{ transitionDelay: `${idx * 100}ms` }}>
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl mb-4 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-slate-400">{item.icon}</span>
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-on-surface-variant">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Convocatorias destacadas - SOLO VISUALES, NO CLICKEABLES */}
      <section className="py-12 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8 animate-on-scroll">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Prepárate para las convocatorias más importantes</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {convocatoriasDestacadas.map((conv, idx) => (
              <span
                key={idx}
                className={`px-6 py-3 rounded-full text-sm font-bold ${conv.color} shadow-sm animate-on-scroll`}
                style={{ transitionDelay: `${idx * 80}ms` }}
              >
                {conv.nombre}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final - Solo autenticación */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-primary rounded-[2.5rem] p-12 md:p-20 text-center text-on-primary shadow-2xl relative overflow-hidden animate-on-scroll">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6">Empieza hoy tu preparación</h2>
              <p className="text-primary-fixed-dim text-lg mb-10 max-w-2xl mx-auto">
                Regístrate gratis y descubre cómo Praxia puede ayudarte a alcanzar tu meta académica o laboral.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => navigate('/login')} className="bg-white text-primary px-12 py-5 rounded-full font-bold text-xl hover:bg-blue-50 transition-all active:scale-95 shadow-xl">
                  Iniciar sesión
                </button>
                <button onClick={() => navigate('/registro')} className="border-2 border-white/30 text-white px-12 py-5 rounded-full font-bold text-xl hover:bg-white/10 transition-all active:scale-95">
                  Crear cuenta
                </button>
              </div>
              <p className="mt-6 text-sm text-primary-fixed-dim/80">
                Sin compromiso, explora la plataforma a tu ritmo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer simplificado - sin enlaces a catálogo/planes */}
      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary">school</span>
                <span className="text-xl font-bold text-primary">PRAXIA</span>
              </div>
              <p className="text-sm text-slate-500">Plataforma de preparación para pruebas del Estado Colombiano.</p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm uppercase tracking-wider text-slate-600">Navegación</h4>
              <ul className="space-y-2">
                <li><button onClick={scrollToTop} className="text-slate-500 hover:text-primary text-sm">Inicio</button></li>
                <li><button onClick={() => scrollToSection('como-funciona')} className="text-slate-500 hover:text-primary text-sm">Cómo funciona</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm uppercase tracking-wider text-slate-600">Legal</h4>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/terminos')} className="text-slate-500 hover:text-primary text-sm">Términos</button></li>
                <li><button onClick={() => navigate('/privacidad')} className="text-slate-500 hover:text-primary text-sm">Privacidad</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400">© 2024 Praxia. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}