import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, FileText, Users, Zap, Shield, TrendingUp, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { waitlistAPI } from '../services/api';

const Landing = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.email.match(/^\S+@\S+\.\S+$/)) {
      toast.error('Proszę podać prawidłowy adres email');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await waitlistAPI.signup(formData);
      
      // Check if email already existed
      if (response.alreadyExists) {
        toast.success(response.message || 'Ten adres email jest już na liście oczekujących');
      } else {
        setIsSubmitted(true);
        toast.success(response.message || 'Dziękujemy! Zostałeś dodany do listy oczekujących.');
        // Reset form after successful submission
        setFormData({ email: '', name: '', company: '' });
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Wystąpił błąd podczas zapisywania. Spróbuj ponownie.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const features = [
    {
      icon: <FileText className="w-8 h-8" />,
      title: 'Generowanie Ofert',
      description: 'Automatyczne tworzenie profesjonalnych ofert w formacie PDF i HTML'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Zarządzanie Klientami',
      description: 'Kompleksowe zarządzanie bazą klientów i projektów'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Automatyzacja',
      description: 'Automatyczne przypomnienia, follow-upy i monitorowanie statusów'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Bezpieczeństwo',
      description: 'Bezpieczne przechowywanie danych i kontrola dostępu'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Raporty i Analizy',
      description: 'Śledzenie statystyk, konwersji i efektywności sprzedaży'
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      title: 'Portal Klienta',
      description: 'Dedykowany portal dla klientów do przeglądania ofert i projektów'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Ofertownik</h1>
                <p className="text-xs text-gray-500">Soft Synergy</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Zaloguj się
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            Autorski program Soft Synergy
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Ofertownik
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
            Zaawansowany system do zarządzania ofertami, klientami i projektami.
            <br />
            <span className="text-gray-500 text-lg mt-2 block">
              Obecnie projekt wewnętrzny, w przyszłości dostępny jako produkt masowy.
            </span>
          </p>
        </div>

        {/* Waitlist Form */}
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            <div className="text-center mb-6">
              <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Zapisz się na listę oczekujących
              </h2>
              <p className="text-gray-600">
                Bądź pierwszy, gdy Ofertownik stanie się dostępny dla wszystkich
              </p>
            </div>

            {isSubmitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Dziękujemy!
                </h3>
                <p className="text-gray-600 mb-6">
                  Zostałeś dodany do listy oczekujących. Powiadomimy Cię, gdy Ofertownik będzie dostępny.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Zapisz kolejną osobę
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Adres email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="twoj@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Imię i nazwisko
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Jan Kowalski"
                  />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                    Nazwa firmy
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Moja Firma Sp. z o.o."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Zapisywanie...</span>
                    </>
                  ) : (
                    <>
                      <span>Zapisz się na listę oczekujących</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Co oferuje Ofertownik?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Kompleksowe narzędzie do zarządzania całym procesem sprzedażowym
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="text-blue-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="bg-white border-t border-gray-200 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              O projekcie
            </h2>
            <div className="prose prose-lg max-w-none text-gray-600 space-y-4 text-left">
              <p>
                <strong>Ofertownik</strong> to autorski system stworzony przez <strong>Soft Synergy</strong> 
                do zarządzania ofertami, klientami i projektami. Obecnie jest to projekt wewnętrzny, 
                który służy do codziennej pracy naszej firmy.
              </p>
              <p>
                System został zaprojektowany z myślą o kompleksowym wsparciu procesu sprzedażowego - 
                od pierwszego kontaktu z klientem, przez generowanie profesjonalnych ofert, 
                aż po zarządzanie projektami i portfelem klientów.
              </p>
              <p>
                W przyszłości planujemy udostępnić Ofertownik jako produkt masowy, 
                aby inne firmy mogły korzystać z naszych rozwiązań. Jeśli jesteś zainteresowany, 
                zapisz się na listę oczekujących, a poinformujemy Cię, gdy system stanie się dostępny.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold">Ofertownik</span>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} Soft Synergy. Wszelkie prawa zastrzeżone.
            </p>
            <p className="text-xs mt-2 text-gray-500">
              Projekt wewnętrzny Soft Synergy
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

