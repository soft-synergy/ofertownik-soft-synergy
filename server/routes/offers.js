const express = require('express');
const jsPDF = require('jspdf');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const multer = require('multer');
const Project = require('../models/Project');
const Portfolio = require('../models/Portfolio');
const Activity = require('../models/Activity');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    try {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    } catch (e) {}
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// PDF font setup to ensure proper rendering of Polish diacritics
// Returns object with { regular, bold } font names registered in the PDF document
function setupUnicodeFonts(doc) {
  let regular = 'Helvetica';
  let bold = 'Helvetica-Bold';

  try {
    // Prefer bundled fonts (put files into server/public/fonts)
    const localRegular = path.join(__dirname, '../public/fonts/NotoSans-Regular.ttf');
    const localBold = path.join(__dirname, '../public/fonts/NotoSans-Bold.ttf');
    const fsSync = require('fs');
    if (fsSync.existsSync(localRegular)) {
      doc.registerFont('NotoSans-Regular', localRegular);
      regular = 'NotoSans-Regular';
      console.log('Using bundled NotoSans-Regular font');
    }
    if (fsSync.existsSync(localBold)) {
      doc.registerFont('NotoSans-Bold', localBold);
      bold = 'NotoSans-Bold';
      console.log('Using bundled NotoSans-Bold font');
    } else if (regular === 'NotoSans-Regular') {
      // Fallback: if only regular exists, use it for bold too
      bold = 'NotoSans-Regular';
      console.log('Using NotoSans-Regular for bold (fallback)');
    }

    // If no bundled fonts, try common system DejaVu fonts (Linux)
    if (regular === 'Helvetica') {
      const sysRegular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
      const sysBold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
      if (fsSync.existsSync(sysRegular)) {
        doc.registerFont('DejaVuSans', sysRegular);
        regular = 'DejaVuSans';
        console.log('Using system DejaVuSans font');
      }
      if (fsSync.existsSync(sysBold)) {
        doc.registerFont('DejaVuSans-Bold', sysBold);
        bold = 'DejaVuSans-Bold';
        console.log('Using system DejaVuSans-Bold font');
      } else if (regular !== 'Helvetica') {
        bold = regular;
        console.log('Using DejaVuSans for bold (fallback)');
      }
    }

    // macOS fallback (Arial Unicode)
    if (regular === 'Helvetica') {
      const macRegular = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
      if (require('fs').existsSync(macRegular)) {
        doc.registerFont('ArialUnicode', macRegular);
        regular = 'ArialUnicode';
        bold = 'ArialUnicode';
        console.log('Using macOS ArialUnicode font');
      }
    }
  } catch (e) {
    console.error('Font setup error:', e);
    // Keep Helvetica fallback silently
  }

  console.log(`Final fonts: regular=${regular}, bold=${bold}`);
  return { regular, bold };
}

// Simple i18n dictionary for offer template
const i18n = {
  pl: {
    companyTagline: 'Innowacyjne rozwiązania programistyczne',
    offerTitle: 'Oferta Projektowa',
    date: 'Data',
    number: 'Numer',
    forLabel: 'Dla:',
    preliminaryTitle: '📋 Oferta Wstępna / Konsultacja',
    preliminaryLead: 'Niniejsza oferta ma charakter wstępny i konsultacyjny. Po dokładnym poznaniu Państwa potrzeb i wymagań przygotujemy szczegółową ofertę finalną z precyzyjną wyceną.',
    greeting: 'Szanowni Państwo,',
    guardianTitle: 'Państwa Dedykowany Opiekun Projektu',
    solutionScope: 'Proponowane Rozwiązanie i Zakres Prac',
    timeline: 'Harmonogram Projektu',
    investment: 'Inwestycja i Warunki Współpracy',
    tableStage: 'Etap / Usługa',
    tableCost: 'Koszt (PLN netto)',
    totalNet: 'RAZEM (netto)',
    paymentTerms: 'Warunki Płatności',
    warrantySupport: 'Gwarancja i Wsparcie',
    warrantySupportContent: 'Zapewniamy dodatkową 3‑miesięczną gwarancję na wdrożone rozwiązanie. Pozostałe prawa i obowiązki stron wynikają z przepisów prawa polskiego.',
    portfolioTitle: 'Nasze Doświadczenie w Praktyce',
    seeMorePortfolio: 'Zobacz więcej portfolio',
    technologiesTitle: 'Technologie i Metodologie',
    techStack: 'Stack Technologiczny',
    methodologies: 'Metodologie',
    projectsCompleted: 'Zrealizowanych Projektów',
    projectsCompletedDesc: 'Od lat dostarczamy wysokiej jakości rozwiązania dla firm z całej Polski',
    nextSteps: 'Kolejne Kroki',
    prelimNextStepsLead: 'Dziękujemy za zainteresowanie naszymi usługami. Oto jak możemy kontynuować współpracę:',
    prelimStep1: 'Potwierdzenie zainteresowania i zgoda na dalsze konsultacje.',
    prelimStep2: 'Szczegółowa analiza wymagań i przygotowanie oferty finalnej.',
    prelimStep3: 'Prezentacja finalnej oferty z precyzyjną wyceną.',
    finalNextStepsLead: 'Jesteśmy podekscytowani perspektywą współpracy. Oto jak możemy rozpocząć:',
    finalStep1: 'Akceptacja oferty poprzez e-mail zwrotny.',
    finalStep2: 'Podpisanie umowy ramowej o współpracy.',
    finalStep3: 'Zaplanowanie warsztatu "kick-off" z Państwa opiekunem projektu.',
    prelimCta: 'Kontynuuję konsultacje',
    finalCta: 'Akceptuję i rozpoczynam współpracę',
    downloadOffer: 'Pobierz ofertę',
    reservations: 'Zastrzeżenia',
    res1: 'Oferta obejmuje wyłącznie prace wymienione w powyższym zakresie.',
    res2: 'Dodatkowe modyfikacje lub zmiany w trakcie realizacji mogą wymagać osobnej wyceny.',
    res3: 'Soft Synergy rozpoczyna realizację w terminie do 3 dni roboczych od potwierdzenia akceptacji oferty.'
  },
  en: {
    companyTagline: 'Innovative Software Solutions',
    offerTitle: 'Project Offer',
    date: 'Date',
    number: 'Number',
    forLabel: 'For:',
    preliminaryTitle: '📋 Preliminary Offer / Consultation',
    preliminaryLead: 'This offer is preliminary and consultative. After understanding your needs, we will prepare a detailed final offer with precise pricing.',
    greeting: 'Dear Sir/Madam,',
    guardianTitle: 'Your Dedicated Project Manager',
    solutionScope: 'Proposed Solution and Scope of Work',
    timeline: 'Project Timeline',
    investment: 'Investment and Terms of Cooperation',
    tableStage: 'Stage / Service',
    tableCost: 'Cost (PLN net)',
    totalNet: 'TOTAL (net)',
    paymentTerms: 'Payment Terms',
    warrantySupport: 'Warranty and Support',
    warrantySupportContent: 'We provide an additional 3‑month warranty for the implemented solution. All remaining rights and obligations are governed by Polish law.',
    portfolioTitle: 'Our Experience in Practice',
    seeMorePortfolio: 'See more portfolio',
    technologiesTitle: 'Technologies and Methodologies',
    techStack: 'Technology Stack',
    methodologies: 'Methodologies',
    projectsCompleted: 'Completed Projects',
    projectsCompletedDesc: 'For years, we have been delivering high-quality solutions for companies across Poland',
    nextSteps: 'Next Steps',
    prelimNextStepsLead: 'Thank you for your interest. Here is how we can proceed:',
    prelimStep1: 'Confirm interest and agree to further consultations.',
    prelimStep2: 'Detailed requirements analysis and preparation of the final offer.',
    prelimStep3: 'Presentation of the final offer with precise pricing.',
    finalNextStepsLead: 'We are excited about the prospect of working together. Here is how we can start:',
    finalStep1: 'Accept the offer via reply email.',
    finalStep2: 'Sign a framework cooperation agreement.',
    finalStep3: 'Schedule a kick-off workshop with your project manager.',
    prelimCta: 'Proceed with consultation',
    finalCta: 'I accept and want to start',
    downloadOffer: 'Download offer',
    reservations: 'Reservations',
    res1: 'The offer includes only the work listed above.',
    res2: 'Additional modifications or changes during implementation may require a separate quote.',
    res3: 'Soft Synergy starts implementation within 3 business days after confirming acceptance of the offer.'
  }
};

// Helper function to format date
handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toLocaleDateString('pl-PL');
});

// Helper function to format currency
handlebars.registerHelper('formatCurrency', function(amount) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN'
  }).format(amount);
});

// Helper function to add numbers
handlebars.registerHelper('add', function(a, b) {
  return a + b;
});

// Helper function to check equality
handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

// Helper function to check if greater than
handlebars.registerHelper('gt', function(a, b) {
  return a > b;
});

// Helper function to get length
handlebars.registerHelper('length', function(array) {
  return Array.isArray(array) ? array.length : 0;
});

// Helper function to create range
handlebars.registerHelper('range', function(start, end) {
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
});

// Generate offer HTML
router.post('/generate/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'firstName lastName email');
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    // Get portfolio items for the offer (increase limit for carousel)
    const portfolio = await Portfolio.find({ isActive: true })
      .sort({ order: 1 })
      .limit(10);

    // Read the HTML template
    const templatePath = path.join(__dirname, '../templates/offer-template.html');
    const templateContent = await fs.readFile(templatePath, 'utf8');

    // Compile template with Handlebars
    const template = handlebars.compile(templateContent);
    
    // Configure Handlebars to allow prototype properties
    handlebars.allowProtoPropertiesByDefault = true;
    
    // Create template with runtime options
    const templateWithOptions = handlebars.compile(templateContent, {
      allowProtoPropertiesByDefault: true
    });

    // Prepare data for template with language and translations
    const requestedLang = (req.query?.lang || '').toLowerCase();
    const lang = (requestedLang === 'en' || requestedLang === 'pl') ? requestedLang : ((project.language === 'en') ? 'en' : 'pl');
    const t = i18n[lang] || i18n.pl;
    const templateData = {
      lang,
      t,
      // Project details
      projectName: project.name,
      clientName: project.clientName,
      clientContact: project.clientContact,
      clientEmail: project.clientEmail,
      clientPhone: project.clientPhone,
      description: project.description,
      mainBenefit: project.mainBenefit,
      // Offer details
      offerDate: new Date().toLocaleDateString('pl-PL'),
      offerNumber: project.offerNumber || `SS/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/${project._id.toString().slice(-4)}`,
      offerType: project.offerType || 'final',
      priceRange: project.priceRange,
      // Project manager - zawsze Jakub Czajka
      projectManager: {
        name: "Jakub Czajka",
        position: "Senior Project Manager",
        email: "jakub.czajka@soft-synergy.com",
        phone: "+48 793 868 886",
        avatar: "/generated-offers/jakub czajka.jpeg",
        description: "Nazywam się Jakub Czajka i pełnię rolę menedżera projektów w Soft Synergy. Specjalizuję się w koordynowaniu zespołów oraz zarządzaniu realizacją nowoczesnych projektów IT. Dbam o sprawną komunikację, terminowość oraz najwyższą jakość dostarczanych rozwiązań. Moim celem jest zapewnienie klientom profesjonalnej obsługi i skutecznej realizacji ich celów biznesowych."
      },
      // Modules
      modules: project.modules && project.modules.length > 0 ? 
        project.modules.map(module => ({
          name: module.name,
          description: module.description,
          color: module.color || 'blue'
        })) : 
        [{ name: 'Moduł przykładowy', description: 'Opis przykładowego modułu', color: 'blue' }],
      // Timeline
      timeline: project.timeline,
      // Pricing
      pricing: project.pricing,
      // Portfolio items
      portfolio: portfolio.map(item => ({
        _id: item._id.toString(),
        title: item.title,
        description: item.description,
        image: item.image,
        category: item.category,
        technologies: item.technologies,
        client: item.client,
        duration: item.duration,
        results: item.results,
        isActive: item.isActive,
        order: item.order
      })),
      // Custom reservations
      customReservations: project.customReservations || [],
      // Custom payment terms
      customPaymentTerms: project.customPaymentTerms || '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.',
      // Company details
      companyEmail: 'jakub.czajka@soft-synergy.com',
      companyPhone: '+48 793 868 886',
      companyNIP: '123-456-78-90',
      // Technologies and methodologies (from project or defaults)
      technologies: project.technologies || {
        stack: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Tailwind CSS'],
        methodologies: ['Agile', 'Scrum', 'CI/CD', 'Test-Driven Development']
      },
      // Testimonials (can be extended later)
      testimonials: project.testimonials || [
        {
          quote: 'Profesjonalna obsługa, terminowość i wysokiej jakości kod. Polecam!',
          author: 'Jan Kowalski',
          role: 'CEO, Firma XYZ'
        },
        {
          quote: 'Zespół Soft Synergy pomógł nam zrealizować kompleksowy projekt e-commerce w rekordowym czasie.',
          author: 'Anna Nowak',
          role: 'Dyrektor IT, ABC Sp. z o.o.'
        },
        {
          quote: 'Doskonała komunikacja i elastyczne podejście do naszych potrzeb. Współpraca bez zarzutu.',
          author: 'Piotr Wiśniewski',
          role: 'Founder, Startup123'
        }
      ]
    };

    // Generate HTML
    const html = templateWithOptions(templateData);

    // Create generated-offers directory if it doesn't exist
    const outputDir = path.join(__dirname, '../generated-offers');
    await fs.mkdir(outputDir, { recursive: true });

    // Clean up old offer files for this project
    try {
      const existingFiles = await fs.readdir(outputDir);
      const projectFiles = existingFiles.filter(file => file.startsWith(`offer-${project._id}-`));
      
      // Delete old files for this project
      for (const oldFile of projectFiles) {
        const oldFilePath = path.join(outputDir, oldFile);
        await fs.unlink(oldFilePath);
        console.log(`Deleted old offer file: ${oldFile}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up old offer files:', cleanupError);
      // Continue with generation even if cleanup fails
    }

    // Try to generate PDF, but don't fail if it doesn't work
    let pdfFileName = null;
    let pdfUrl = null;
    
    try {
      const PDFDocument = require('pdfkit');
      pdfFileName = `offer-${project._id}-${Date.now()}.pdf`;
      const pdfPath = path.join(outputDir, pdfFileName);

      await new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ 
            size: 'A4', 
            margins: { top: 50, left: 50, right: 50, bottom: 50 },
            info: {
              Title: 'Oferta',
              Author: 'Soft Synergy'
            }
          });
          const fonts = setupUnicodeFonts(doc);
          
          const stream = require('fs').createWriteStream(pdfPath);
          doc.pipe(stream);

          const addText = (text, fontSize = 12, options = {}) => {
            if (!text) return;
            
            const x = 50;
            const width = 495;
            
            doc.fontSize(fontSize);
            doc.text(String(text), x, doc.y, {
              width: width,
              align: options.align || 'left',
              lineGap: 4
            });
          };

          // Add logo and header
          let currentY = 20;
          
          // Try to add logo
          try {
            const logoPath = path.join(__dirname, '../generated-offers/logo-removebg-preview.png');
            if (require('fs').existsSync(logoPath)) {
              doc.image(logoPath, 50, currentY, { width: 80, height: 80 });
              currentY = 120; // Position below logo
            } else {
              currentY = 40;
            }
          } catch (e) {
            console.log('Logo not found');
            currentY = 40;
          }

          // Add company name with colors
          doc.fontSize(24).font(fonts.bold);
          
          // Calculate width first
          const testSoft = doc.widthOfString('Soft');
          const testSynergy = doc.widthOfString('Synergy');
          
          doc.fillColor('#3B82F6')
            .text('Soft', 50, currentY);
          
          doc.fillColor('#A855F7')
            .text('Synergy', 50 + testSoft, currentY);
          
          // Reset color and font
          doc.fillColor('#000000');
          doc.fontSize(16).font(fonts.regular).fillColor('#666666');
          doc.text('Innowacyjne rozwiązania programistyczne', 50, currentY + 35, {
            width: 450,
            align: 'left'
          });
          
          // Reset to black for content
          doc.fillColor('#000000');
          doc.y = currentY + 60; // Move cursor down
          doc.moveDown(1);
          
          // Add title
          doc.fontSize(18).font(fonts.bold).fillColor('#1e40af');
          addText(`OFERTA: ${project.name}`, 18, { align: 'center' });
          doc.moveDown(1);
          
          // Client info
          addText(`Klient: ${project.clientName}`, 12);
          addText(`Numer oferty: ${templateData.offerNumber}`, 12);
          addText(`Data: ${templateData.offerDate}`, 12);
          doc.moveDown(1.5);

          // Description with colored header
          if (project.description) {
            doc.fontSize(14).font(fonts.bold).fillColor('#a855f7');
            addText('Opis projektu:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            addText(project.description, 12);
            doc.moveDown(1);
          }

          // Modules
          if (project.modules && project.modules.length > 0) {
            doc.fontSize(14).font(fonts.bold).fillColor('#3b82f6');
            addText('Zakres prac:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            project.modules.forEach((module, index) => {
              addText(`${index + 1}. ${module.name}`, 12);
              if (module.description) {
                addText(`   ${module.description}`, 10);
              }
            });
            doc.moveDown(1);
          }

          // Timeline
          if (project.timeline) {
            doc.fontSize(14).font(fonts.bold).fillColor('#a855f7');
            addText('Harmonogram:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            if (project.timeline.phase1) {
              addText(`• ${project.timeline.phase1.name}: ${project.timeline.phase1.duration}`, 12);
            }
            if (project.timeline.phase2) {
              addText(`• ${project.timeline.phase2.name}: ${project.timeline.phase2.duration}`, 12);
            }
            if (project.timeline.phase3) {
              addText(`• ${project.timeline.phase3.name}: ${project.timeline.phase3.duration}`, 12);
            }
            if (project.timeline.phase4) {
              addText(`• ${project.timeline.phase4.name}: ${project.timeline.phase4.duration}`, 12);
            }
            doc.moveDown(1);
          }

          // Pricing
          if (project.pricing) {
            doc.fontSize(14).font(fonts.bold).fillColor('#10b981');
            addText('Wycenienie:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            if (project.pricing.phase1 > 0) {
              addText(`Faza I: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase1)}`, 12);
            }
            if (project.pricing.phase2 > 0) {
              addText(`Faza II: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase2)}`, 12);
            }
            if (project.pricing.phase3 > 0) {
              addText(`Faza III: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase3)}`, 12);
            }
            if (project.pricing.phase4 > 0) {
              addText(`Faza IV: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase4)}`, 12);
            }
            if (project.pricing.total) {
              addText(`RAZEM: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.total)}`, 14);
            }
            doc.moveDown(1);
          }

          // Payment terms
          if (project.customPaymentTerms) {
            addText('Warunki płatności:', 14);
            const paymentLines = project.customPaymentTerms.split('\n');
            paymentLines.forEach(line => {
              if (line.trim()) {
                addText(line.trim(), 12);
              }
            });
            doc.moveDown(1);
          }

          // Footer with branding
          doc.moveDown(1);
          doc.fillColor('#cccccc')
            .rect(50, doc.y, 500, 1)
            .fill();
          doc.y += 10;
          
          // Company name with colors
          doc.fontSize(14).font(fonts.bold);
          
          const footerSoft = doc.widthOfString('Soft');
          
          doc.fillColor('#3B82F6')
            .text('Soft', 50, doc.y);
          doc.fillColor('#A855F7')
            .text('Synergy', 50 + footerSoft, doc.y);
          
          // Add signature bottom-right if available
          try {
            const signaturePath = path.join(__dirname, '../../Podpis.jpg');
            if (require('fs').existsSync(signaturePath)) {
              const sigWidth = 140;
              const sigY = doc.page.height - doc.page.margins.bottom - 60;
              const sigX = doc.page.width - doc.page.margins.right - sigWidth;
              doc.image(signaturePath, sigX, sigY, { width: sigWidth });
            }
          } catch (e) {
            // ignore if signature missing
          }

          // Add signature bottom-right if available
          try {
            const signaturePath = path.join(__dirname, '../../Podpis.jpg');
            if (require('fs').existsSync(signaturePath)) {
              const sigWidth = 140;
              const sigY = doc.page.height - doc.page.margins.bottom - 60;
              const sigX = doc.page.width - doc.page.margins.right - sigWidth;
              doc.image(signaturePath, sigX, sigY, { width: sigWidth });
            }
          } catch (e) {
            // ignore if signature missing
          }

          doc.y += 20;
          doc.fontSize(10).font(fonts.regular).fillColor('#666666');
          const contactY1 = doc.y;
          doc.text('Kontakt: jakub.czajka@soft-synergy.com | +48 793 868 886', 50, contactY1, {
            width: 500
          });
          // Signature aligned with contact line (offer)
          try {
            const signaturePath = path.join(__dirname, '../../Podpis.jpg');
            if (require('fs').existsSync(signaturePath)) {
              const sigWidth = 280; // 2x bigger
              const sigX = doc.page.width - doc.page.margins.right - sigWidth;
              const sigY = contactY1 - 10; // slightly above baseline
              doc.image(signaturePath, sigX, sigY, { width: sigWidth });
            }
          } catch (e) {}
          
          doc.y += 15;
          doc.text('Innowacyjne rozwiązania programistyczne', 50, doc.y, {
            width: 500
          });

          doc.end();
          stream.on('finish', resolve);
          stream.on('error', reject);
        } catch (e) {
          reject(e);
        }
      });

      pdfUrl = `/generated-offers/${pdfFileName}`;
      console.log('Offer PDF generated successfully');
    } catch (pdfError) {
      console.error('Offer PDF generation failed:', pdfError);
      console.log('Continuing with HTML generation only');
    }

    // After PDF attempt, render HTML with pdfUrl included and save
    templateData.pdfUrl = pdfUrl;
    const fileName = `offer-${project._id}-${Date.now()}.html`;
    const filePath = path.join(outputDir, fileName);
    const htmlOutput = templateWithOptions(templateData);
    await fs.writeFile(filePath, htmlOutput);

    // Update project with generated offer URL and PDF URL
    project.generatedOfferUrl = `/generated-offers/${fileName}`;
    if (pdfUrl) {
      project.pdfUrl = pdfUrl;
    }
    
    // Try to save to database, but don't fail if it doesn't work (for local testing)
    try {
      await project.save();
      console.log('Project saved to database successfully');
    } catch (dbError) {
      console.log('Database save failed (local testing mode):', dbError.message);
      // Continue anyway - we'll return the URLs in response
    }

    // Log activity
    try {
      await Activity.create({
        action: 'offer.generated',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `Offer generated for project "${project.name}"`,
        metadata: { htmlUrl: `/generated-offers/${fileName}`, pdfUrl }
      });
    } catch (e) {
      // ignore logging errors
    }

    // Add cache-busting headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      message: pdfUrl ? 'Oferta została wygenerowana pomyślnie' : 'Oferta HTML została wygenerowana pomyślnie (PDF nie udało się wygenerować)',
      htmlUrl: `/generated-offers/${fileName}`,
      professionalUrl: `/oferta-finalna/${project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      pdfUrl: pdfUrl,
      project: project
    });

  } catch (error) {
    console.error('Generate offer error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania oferty' });
  }
});

// Get offer preview (HTML)
router.get('/preview/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'firstName lastName email');
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    // Get portfolio items (increase limit for carousel)
    const portfolio = await Portfolio.find({ isActive: true })
      .sort({ order: 1 })
      .limit(10);

    // Read template
    const templatePath = path.join(__dirname, '../templates/offer-template.html');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);

    // Prepare data with language and translations
    const requestedLang = (req.query?.lang || '').toLowerCase();
    const lang = (requestedLang === 'en' || requestedLang === 'pl') ? requestedLang : ((project.language === 'en') ? 'en' : 'pl');
    const t = i18n[lang] || i18n.pl;
    const templateData = {
      lang,
      t,
      projectName: project.name,
      clientName: project.clientName,
      clientContact: project.clientContact,
      clientEmail: project.clientEmail,
      clientPhone: project.clientPhone,
      description: project.description,
      mainBenefit: project.mainBenefit,
      offerDate: new Date().toLocaleDateString('pl-PL'),
      offerNumber: project.offerNumber || 'SS/2024/05/01',
      offerType: project.offerType || 'final',
      priceRange: project.priceRange,
      projectManager: project.projectManager,
      modules: project.modules,
      timeline: project.timeline,
      pricing: project.pricing,
      portfolio: portfolio,
      customReservations: project.customReservations || [],
      customPaymentTerms: project.customPaymentTerms || '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.',
      companyEmail: 'jakub.czajka@soft-synergy.com',
      companyPhone: '+48 793 868 886',
      companyNIP: '123-456-78-90',
      technologies: project.technologies || {
        stack: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Tailwind CSS'],
        methodologies: ['Agile', 'Scrum', 'CI/CD', 'Test-Driven Development']
      },
      testimonials: project.testimonials || [
        {
          quote: 'Profesjonalna obsługa, terminowość i wysokiej jakości kod. Polecam!',
          author: 'Jan Kowalski',
          role: 'CEO, Firma XYZ'
        },
        {
          quote: 'Zespół Soft Synergy pomógł nam zrealizować kompleksowy projekt e-commerce w rekordowym czasie.',
          author: 'Anna Nowak',
          role: 'Dyrektor IT, ABC Sp. z o.o.'
        },
        {
          quote: 'Doskonała komunikacja i elastyczne podejście do naszych potrzeb. Współpraca bez zarzutu.',
          author: 'Piotr Wiśniewski',
          role: 'Founder, Startup123'
        }
      ]
    };

    const html = template(templateData);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Preview offer error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania podglądu' });
  }
});



// Generate professional offer URL
router.get('/professional-url/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }
    
    // Generate slug from project name
    const slug = project.name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const professionalUrl = `http://oferty.soft-synergy.com/oferta-finalna/${slug}`;
    
    res.json({
      professionalUrl,
      slug,
      projectName: project.name,
      message: 'Profesjonalny link został wygenerowany'
    });
    
  } catch (error) {
    console.error('Generate professional URL error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania profesjonalnego linku' });
  }
});

// Generate PDF only endpoint
router.post('/generate-pdf/:projectId', auth, async (req, res) => {
  try {
    // Try to get project from database first, if fails use data from request body
    let project;
    try {
      project = await Project.findById(req.params.projectId)
        .populate('createdBy', 'firstName lastName email');
    } catch (dbError) {
      console.log('Database not available, using request body data');
      // Use data from request body if database is not available
      project = req.body;
    }
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    // Get portfolio items for the offer
    const portfolio = await Portfolio.find({ isActive: true })
      .sort({ order: 1 })
      .limit(10);

    // Read the HTML template
    const templatePath = path.join(__dirname, '../templates/offer-template.html');
    const templateContent = await fs.readFile(templatePath, 'utf8');

    // Compile template with Handlebars
    const template = handlebars.compile(templateContent);
    
    // Prepare data for template with language and translations
    const requestedLang = (req.query?.lang || '').toLowerCase();
    const lang = (requestedLang === 'en' || requestedLang === 'pl') ? requestedLang : ((project.language === 'en') ? 'en' : 'pl');
    const t = i18n[lang] || i18n.pl;
    const templateData = {
      lang,
      t,
      // Project details
      projectName: project.name,
      clientName: project.clientName,
      clientContact: project.clientContact,
      clientEmail: project.clientEmail,
      clientPhone: project.clientPhone,
      description: project.description,
      mainBenefit: project.mainBenefit,
      // Offer details
      offerDate: new Date().toLocaleDateString('pl-PL'),
      offerNumber: project.offerNumber || `SS/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/${project._id.toString().slice(-4)}`,
      offerType: project.offerType || 'final',
      priceRange: project.priceRange,
      // Project manager - zawsze Jakub Czajka
      projectManager: {
        name: "Jakub Czajka",
        position: "Senior Project Manager",
        email: "jakub.czajka@soft-synergy.com",
        phone: "+48 793 868 886",
        avatar: "/generated-offers/jakub czajka.jpeg",
        description: "Nazywam się Jakub Czajka i pełnię rolę menedżera projektów w Soft Synergy. Specjalizuję się w koordynowaniu zespołów oraz zarządzaniu realizacją nowoczesnych projektów IT. Dbam o sprawną komunikację, terminowość oraz najwyższą jakość dostarczanych rozwiązań. Moim celem jest zapewnienie klientom profesjonalnej obsługi i skutecznej realizacji ich celów biznesowych."
      },
      // Modules
      modules: project.modules && project.modules.length > 0 ? 
        project.modules.map(module => ({
          name: module.name,
          description: module.description,
          color: module.color || 'blue'
        })) : 
        [{ name: 'Moduł przykładowy', description: 'Opis przykładowego modułu', color: 'blue' }],
      // Timeline
      timeline: project.timeline,
      // Pricing
      pricing: project.pricing,
      // Portfolio items
      portfolio: portfolio.map(item => ({
        _id: item._id.toString(),
        title: item.title,
        description: item.description,
        image: item.image,
        category: item.category,
        technologies: item.technologies,
        client: item.client,
        duration: item.duration,
        results: item.results,
        isActive: item.isActive,
        order: item.order
      })),
      // Custom reservations
      customReservations: project.customReservations || [],
      // Custom payment terms
      customPaymentTerms: project.customPaymentTerms || '10% zaliczki po podpisaniu umowy.\n90% po odbiorze końcowym projektu.',
      // Company details
      companyEmail: 'jakub.czajka@soft-synergy.com',
      companyPhone: '+48 793 868 886',
      companyNIP: '123-456-78-90',
      // Technologies and methodologies (from project or defaults)
      technologies: project.technologies || {
        stack: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Tailwind CSS'],
        methodologies: ['Agile', 'Scrum', 'CI/CD', 'Test-Driven Development']
      },
      // Testimonials (can be extended later)
      testimonials: project.testimonials || [
        {
          quote: 'Profesjonalna obsługa, terminowość i wysokiej jakości kod. Polecam!',
          author: 'Jan Kowalski',
          role: 'CEO, Firma XYZ'
        },
        {
          quote: 'Zespół Soft Synergy pomógł nam zrealizować kompleksowy projekt e-commerce w rekordowym czasie.',
          author: 'Anna Nowak',
          role: 'Dyrektor IT, ABC Sp. z o.o.'
        },
        {
          quote: 'Doskonała komunikacja i elastyczne podejście do naszych potrzeb. Współpraca bez zarzutu.',
          author: 'Piotr Wiśniewski',
          role: 'Founder, Startup123'
        }
      ]
    };

    // Generate HTML
    const html = template(templateData);

    // Create generated-offers directory if it doesn't exist
    const outputDir = path.join(__dirname, '../generated-offers');
    await fs.mkdir(outputDir, { recursive: true });

    // Clean up old PDF files for this project
    try {
      const existingFiles = await fs.readdir(outputDir);
      const projectPdfFiles = existingFiles.filter(file => file.startsWith(`offer-${project._id}-`) && file.endsWith('.pdf'));
      
      // Delete old PDF files for this project
      for (const oldPdfFile of projectPdfFiles) {
        const oldPdfFilePath = path.join(outputDir, oldPdfFile);
        await fs.unlink(oldPdfFilePath);
        console.log(`Deleted old PDF file: ${oldPdfFile}`);
      }
    } catch (pdfCleanupError) {
      console.error('Error cleaning up old PDF files:', pdfCleanupError);
    }

    // Generate PDF using pdfkit
    const PDFDocument = require('pdfkit');
    const pdfFileName = `offer-${project._id}-${Date.now()}.pdf`;
    const pdfPath = path.join(outputDir, pdfFileName);

    await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margins: { top: 50, left: 50, right: 50, bottom: 50 } 
        });
        const fonts = setupUnicodeFonts(doc);
        doc.font(fonts.regular);
        const stream = require('fs').createWriteStream(pdfPath);
        doc.pipe(stream);

        // Helper function to clean text and handle line breaks
        const cleanText = (text) => {
          if (!text) return '';
          return text.toString()
            .replace(/[\u201C\u201D]/g, '"') // Replace smart quotes
            .replace(/[\u2018\u2019]/g, "'") // Replace smart apostrophes
            .replace(/[\u2013\u2014]/g, "-") // Replace em/en dashes
            .replace(/[\u2026]/g, "...") // Replace ellipsis
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        };

        // Helper function to add text with proper line breaks
        const addText = (text, fontSize = 12, options = {}) => {
          const cleanedText = cleanText(text);
          doc.fontSize(fontSize);
          doc.text(cleanedText, options);
        };

        // Title
        addText(`Oferta: ${project.name}`, 20, { align: 'center' });
        doc.moveDown(1);
        
        // Client info
        addText(`Klient: ${project.clientName}`, 14);
        if (project.clientEmail) {
          addText(`Email: ${project.clientEmail}`, 12);
        }
        if (project.clientPhone) {
          addText(`Telefon: ${project.clientPhone}`, 12);
        }
        doc.moveDown(1);

        // Offer number and date
        addText(`Numer oferty: ${templateData.offerNumber}`, 12);
        addText(`Data: ${templateData.offerDate}`, 12);
        doc.moveDown(1);

        // Description
        if (project.description) {
          addText('Opis projektu:', 14);
          addText(project.description, 12);
          doc.moveDown(1);
        }

        // Modules
        if (project.modules && project.modules.length > 0) {
          addText('Zakres prac:', 14);
          project.modules.forEach((module, index) => {
            addText(`${index + 1}. ${module.name}`, 12);
            if (module.description) {
              addText(`   ${module.description}`, 10);
            }
          });
          doc.moveDown(1);
        }

        // Timeline
        if (project.timeline) {
          addText('Harmonogram:', 14);
          if (project.timeline.phase1) {
            addText(`• ${project.timeline.phase1.name}: ${project.timeline.phase1.duration}`, 12);
          }
          if (project.timeline.phase2) {
            addText(`• ${project.timeline.phase2.name}: ${project.timeline.phase2.duration}`, 12);
          }
          if (project.timeline.phase3) {
            addText(`• ${project.timeline.phase3.name}: ${project.timeline.phase3.duration}`, 12);
          }
          if (project.timeline.phase4) {
            addText(`• ${project.timeline.phase4.name}: ${project.timeline.phase4.duration}`, 12);
          }
          doc.moveDown(1);
        }

        // Pricing
        if (project.pricing) {
          addText('Wycenienie:', 14);
          if (project.pricing.phase1 > 0) {
            addText(`Faza I: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase1)}`, 12);
          }
          if (project.pricing.phase2 > 0) {
            addText(`Faza II: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase2)}`, 12);
          }
          if (project.pricing.phase3 > 0) {
            addText(`Faza III: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase3)}`, 12);
          }
          if (project.pricing.phase4 > 0) {
            addText(`Faza IV: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.phase4)}`, 12);
          }
          if (project.pricing.total) {
            addText(`RAZEM: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(project.pricing.total)}`, 14);
          }
          doc.moveDown(1);
        }

        // Payment terms
        if (project.customPaymentTerms) {
          addText('Warunki płatności:', 14);
          // Split payment terms by newlines and add each line separately
          const paymentLines = project.customPaymentTerms.split('\n');
          paymentLines.forEach(line => {
            if (line.trim()) {
              addText(line.trim(), 12);
            }
          });
          doc.moveDown(1);
        }

        // Contact info
        addText('Kontakt:', 12);
        addText('Jakub Czajka - Soft Synergy', 12);
        addText('Email: jakub.czajka@soft-synergy.com', 12);
        addText('Telefon: +48 793 868 886', 12);

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });

    // Update project with PDF URL
    project.pdfUrl = `/generated-offers/${pdfFileName}`;
    await project.save();

    // Log activity
    try {
      await Activity.create({
        action: 'offer.pdf.generated',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `PDF offer generated for project "${project.name}"`,
        metadata: { pdfUrl: project.pdfUrl }
      });
    } catch (e) {
      // ignore logging errors
    }

    res.json({
      message: 'PDF oferty został wygenerowany pomyślnie',
      pdfUrl: project.pdfUrl,
      fileName: pdfFileName
    });

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania PDF' });
  }
});

// Simple PDF generation endpoint without database dependency
router.post('/generate-pdf-simple', auth, async (req, res) => {
  try {
    const projectData = req.body;
    
    if (!projectData.name || !projectData.clientName) {
      return res.status(400).json({ message: 'Brakuje wymaganych danych: name, clientName' });
    }

    // Create generated-offers directory if it doesn't exist
    const outputDir = path.join(__dirname, '../generated-offers');
    await fs.mkdir(outputDir, { recursive: true });

    // Generate PDF using pdfkit
    const PDFDocument = require('pdfkit');
    const pdfFileName = `offer-${Date.now()}.pdf`;
    const pdfPath = path.join(outputDir, pdfFileName);

    await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margins: { top: 50, left: 50, right: 50, bottom: 50 } 
        });
        const fonts = setupUnicodeFonts(doc);
        doc.font(fonts.regular);
        const stream = require('fs').createWriteStream(pdfPath);
        doc.pipe(stream);

        // Helper function to clean text and handle line breaks
        const cleanText = (text) => {
          if (!text) return '';
          return text.toString()
            .replace(/[\u201C\u201D]/g, '"') // Replace smart quotes
            .replace(/[\u2018\u2019]/g, "'") // Replace smart apostrophes
            .replace(/[\u2013\u2014]/g, "-") // Replace em/en dashes
            .replace(/[\u2026]/g, "...") // Replace ellipsis
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        };

        // Helper function to add text with proper line breaks
        const addText = (text, fontSize = 12, options = {}) => {
          const cleanedText = cleanText(text);
          doc.fontSize(fontSize);
          doc.text(cleanedText, options);
        };

        // Title
        addText(`Oferta: ${projectData.name}`, 20, { align: 'center' });
        doc.moveDown(1);
        
        // Client info
        addText(`Klient: ${projectData.clientName}`, 14);
        if (projectData.clientEmail) {
          addText(`Email: ${projectData.clientEmail}`, 12);
        }
        if (projectData.clientPhone) {
          addText(`Telefon: ${projectData.clientPhone}`, 12);
        }
        doc.moveDown(1);

        // Offer number and date
        addText(`Numer oferty: ${projectData.offerNumber || `SS/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/01`}`, 12);
        addText(`Data: ${new Date().toLocaleDateString('pl-PL')}`, 12);
        doc.moveDown(1);

        // Description
        if (projectData.description) {
          addText('Opis projektu:', 14);
          addText(projectData.description, 12);
          doc.moveDown(1);
        }

        // Modules
        if (projectData.modules && projectData.modules.length > 0) {
          addText('Zakres prac:', 14);
          projectData.modules.forEach((module, index) => {
            addText(`${index + 1}. ${module.name}`, 12);
            if (module.description) {
              addText(`   ${module.description}`, 10);
            }
          });
          doc.moveDown(1);
        }

        // Timeline
        if (projectData.timeline) {
          addText('Harmonogram:', 14);
          if (projectData.timeline.phase1) {
            addText(`• ${projectData.timeline.phase1.name}: ${projectData.timeline.phase1.duration}`, 12);
          }
          if (projectData.timeline.phase2) {
            addText(`• ${projectData.timeline.phase2.name}: ${projectData.timeline.phase2.duration}`, 12);
          }
          if (projectData.timeline.phase3) {
            addText(`• ${projectData.timeline.phase3.name}: ${projectData.timeline.phase3.duration}`, 12);
          }
          if (projectData.timeline.phase4) {
            addText(`• ${projectData.timeline.phase4.name}: ${projectData.timeline.phase4.duration}`, 12);
          }
          doc.moveDown(1);
        }

        // Pricing
        if (projectData.pricing) {
          addText('Wycenienie:', 14);
          if (projectData.pricing.phase1 > 0) {
            addText(`Faza I: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(projectData.pricing.phase1)}`, 12);
          }
          if (projectData.pricing.phase2 > 0) {
            addText(`Faza II: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(projectData.pricing.phase2)}`, 12);
          }
          if (projectData.pricing.phase3 > 0) {
            addText(`Faza III: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(projectData.pricing.phase3)}`, 12);
          }
          if (projectData.pricing.phase4 > 0) {
            addText(`Faza IV: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(projectData.pricing.phase4)}`, 12);
          }
          if (projectData.pricing.total) {
            addText(`RAZEM: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(projectData.pricing.total)}`, 14);
          }
          doc.moveDown(1);
        }

        // Payment terms
        if (projectData.customPaymentTerms) {
          addText('Warunki płatności:', 14);
          const paymentLines = projectData.customPaymentTerms.split('\n');
          paymentLines.forEach(line => {
            if (line.trim()) {
              addText(line.trim(), 12);
            }
          });
          doc.moveDown(1);
        }

        // Contact info
        addText('Kontakt:', 12);
        addText('Jakub Czajka - Soft Synergy', 12);
        addText('Email: jakub.czajka@soft-synergy.com', 12);
        addText('Telefon: +48 793 868 886', 12);

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });

    // Update project with PDF URL if we have project data
    if (projectData._id) {
      try {
        const Project = require('../models/Project');
        const updatedProject = await Project.findByIdAndUpdate(projectData._id, {
          pdfUrl: `/generated-offers/${pdfFileName}`
        }, { new: true });
        console.log('Updated project PDF URL:', projectData._id, 'New PDF URL:', updatedProject?.pdfUrl);
      } catch (updateError) {
        console.log('Database update failed (local testing mode):', updateError.message);
        console.log('Project ID:', projectData._id);
        // Continue anyway - we'll return the PDF URL in response
      }
    } else {
      console.log('No project ID provided, cannot update database');
    }

    res.json({
      message: 'PDF oferty został wygenerowany pomyślnie',
      pdfUrl: `/generated-offers/${pdfFileName}`,
      fileName: pdfFileName
    });

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania PDF' });
  }
});

// i18n for work summary
const workSummaryI18n = {
  pl: {
    companyTagline: 'Innowacyjne rozwiązania programistyczne',
    summaryTitle: 'Zestawienie Prac',
    date: 'Data',
    number: 'Numer',
    projectLabel: 'Projekt:',
    clientLabel: 'Klient:',
    intro: 'Podsumowanie',
    introText: 'Niniejsze zestawienie zawiera szczegółowy przegląd wykonanych prac w ramach projektu. Dokument przedstawia zakres realizowanych zadań, osiągnięte rezultaty oraz status projektu.',
    projectDetails: 'Szczegóły Projektu',
    projectName: 'Nazwa projektu',
    clientName: 'Klient',
    period: 'Okres realizacji',
    status: 'Status',
    completedWork: 'Wykonane Prace',
    completedDate: 'Data ukończenia',
    keyFeatures: 'Kluczowe Funkcjonalności',
    statistics: 'Statystyki Projektu',
    achievements: 'Osiągnięcia',
    technicalNotes: 'Uwagi techniczne',
    nextSteps: 'Następne kroki',
    downloadSummary: 'Pobierz zestawienie'
  },
  en: {
    companyTagline: 'Innovative Software Solutions',
    summaryTitle: 'Work Summary',
    date: 'Date',
    number: 'Number',
    projectLabel: 'Project:',
    clientLabel: 'Client:',
    intro: 'Summary',
    introText: 'This document provides a detailed overview of work completed within the project scope. It presents the range of tasks performed, achieved results, and project status.',
    projectDetails: 'Project Details',
    projectName: 'Project name',
    clientName: 'Client',
    period: 'Period',
    status: 'Status',
    completedWork: 'Completed Work',
    completedDate: 'Completion date',
    keyFeatures: 'Key Features',
    statistics: 'Project Statistics',
    achievements: 'Achievements',
    technicalNotes: 'Technical Notes',
    nextSteps: 'Next Steps',
    downloadSummary: 'Download summary'
  }
};

// Generate work summary
router.post('/generate-work-summary/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'firstName lastName email');
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    const templatePath = path.join(__dirname, '../templates/work-summary-template.html');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    
    const requestedLang = (req.query?.lang || '').toLowerCase();
    const lang = (requestedLang === 'en' || requestedLang === 'pl') ? requestedLang : ((project.language === 'en') ? 'en' : 'pl');
    const t = workSummaryI18n[lang] || workSummaryI18n.pl;

    // Parse work summary data from request body or use defaults
    const workSummaryData = {
      lang,
      t,
      projectName: project.name,
      clientName: project.clientName,
      summaryDate: new Date().toLocaleDateString('pl-PL'),
      summaryNumber: project.offerNumber || `WP/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/${project._id.toString().slice(-4)}`,
      summaryDescription: req.body.summaryDescription || 'Dzięki wspólnej pracy udało nam się zrealizować wszystkie założone cele projektu.',
      periodStart: req.body.periodStart || new Date(project.createdAt).toLocaleDateString('pl-PL'),
      periodEnd: req.body.periodEnd || new Date().toLocaleDateString('pl-PL'),
      status: req.body.status || project.status,
      completedTasks: req.body.completedTasks || [
        {
          name: 'Analiza wymagań',
          description: 'Przeprowadzenie szczegółowej analizy potrzeb klienta',
          date: new Date().toLocaleDateString('pl-PL')
        },
        {
          name: 'Implementacja',
          description: 'Realizacja głównych funkcjonalności systemu',
          date: new Date().toLocaleDateString('pl-PL')
        }
      ],
      keyFeatures: req.body.keyFeatures || project.modules.map(m => ({
        name: m.name,
        description: m.description,
        color: m.color || 'blue'
      })),
      statistics: req.body.statistics || [
        { label: 'Dni współpracy', value: '14+' },
        { label: 'Wykonane moduły', value: '4' },
        { label: 'Satisfaction rate', value: '100%' }
      ],
      achievements: req.body.achievements || [
        {
          name: 'Terminowa realizacja',
          description: 'Projekt zakończony zgodnie z harmonogramem'
        },
        {
          name: 'Wysoka jakość',
          description: 'Wszystkie funkcjonalności spełniają najwyższe standardy'
        }
      ],
      statistics: req.body.statistics || [
        { label: 'Dni współpracy', value: '14+' },
        { label: 'Wykonane moduły', value: '4' },
        { label: 'Status projektu', value: 'W trakcie realizacji' }
      ],
      achievements: req.body.achievements || [
        {
          name: 'Terminowa realizacja',
          description: 'Projekt realizowany zgodnie z harmonogramem'
        },
        {
          name: 'Wysoka jakość',
          description: 'Wszystkie funkcjonalności spełniają wymagania'
        }
      ],
      companyEmail: 'jakub.czajka@soft-synergy.com',
      companyPhone: '+48 793 868 886',
      baseUrl: (req.get('host') ? ((req.protocol || 'https') + '://' + req.get('host')) : 'https://oferty.soft-synergy.com'),
      // invoice links
      vatUrl: (project.documents || []).find(d => d.type === 'vat') ? (project.documents.find(d => d.type === 'vat').filePath) : null,
      proformaUrl: (project.documents || []).find(d => d.type === 'proforma') ? (project.documents.find(d => d.type === 'proforma').filePath) : null
    };

    const html = template(workSummaryData);

    const outputDir = path.join(__dirname, '../generated-offers');
    await fs.mkdir(outputDir, { recursive: true });

    // Clean up old work summary files for this project
    try {
      const existingFiles = await fs.readdir(outputDir);
      const projectFiles = existingFiles.filter(file => file.startsWith(`work-summary-${project._id}-`));
      
      for (const oldFile of projectFiles) {
        const oldFilePath = path.join(outputDir, oldFile);
        await fs.unlink(oldFilePath);
        console.log(`Deleted old work summary file: ${oldFile}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up old work summary files:', cleanupError);
    }

    const fileName = `work-summary-${project._id}-${Date.now()}.html`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, html);

    // Generate PDF
    let pdfFileName = null;
    let pdfUrl = null;
    
    try {
      const PDFDocument = require('pdfkit');
      pdfFileName = `work-summary-${project._id}-${Date.now()}.pdf`;
      const pdfPath = path.join(outputDir, pdfFileName);

      await new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ 
            size: 'A4', 
            margins: { top: 50, left: 50, right: 50, bottom: 50 },
            info: {
              Title: 'Oferta',
              Author: 'Soft Synergy'
            }
          });
          const fonts = setupUnicodeFonts(doc);
          
          const stream = require('fs').createWriteStream(pdfPath);
          doc.pipe(stream);

          const addText = (text, fontSize = 12, options = {}) => {
            if (!text) return;
            
            const x = 50;
            const width = 495;
            
            doc.fontSize(fontSize);
            doc.text(String(text), x, doc.y, {
              width: width,
              align: options.align || 'left',
              lineGap: 4
            });
          };

          // Add logo and header
          let currentY = 20;
          
          try {
            const logoPath = path.join(__dirname, '../generated-offers/logo-removebg-preview.png');
            if (require('fs').existsSync(logoPath)) {
              doc.image(logoPath, 50, currentY, { width: 80, height: 80 });
              currentY = 120;
            } else {
              currentY = 40;
            }
          } catch (e) {
            currentY = 40;
          }

          // Add company name with colors
          doc.fontSize(24).font(fonts.bold);
          doc.fillColor('#3B82F6')
            .text('Soft', 50, currentY);
          let softW = doc.widthOfString('Soft');
          doc.fillColor('#A855F7')
            .text('Synergy', 50 + softW, currentY);
          
          doc.fillColor('#000000');
          doc.fontSize(16).font(fonts.regular).fillColor('#666666');
          doc.text('Innowacyjne rozwiązania programistyczne', 50, currentY + 35, {
            width: 450
          });
          
          doc.fillColor('#000000');
          doc.y = currentY + 60;
          doc.moveDown(1);
          
          // Title with branding
          doc.fontSize(20).font(fonts.bold).fillColor('#1e40af');
          addText(`ZESTAWIENIE PRAC: ${project.name}`, 18, { align: 'center' });
          doc.moveDown(1);
          doc.font(fonts.regular).fillColor('#000000');
          
          // Client info with styling
          doc.fontSize(12).font(fonts.bold).fillColor('#1e40af');
          doc.text('Klient:', 50, doc.y);
          doc.font(fonts.regular).fillColor('#000000');
          doc.text(project.clientName, 100, doc.y);
          doc.y += 20;
          doc.text(`Numer zestawienia: ${workSummaryData.summaryNumber}`, 50, doc.y);
          doc.y += 15;
          doc.text(`Data: ${workSummaryData.summaryDate}`, 50, doc.y);
          doc.y += 20;
          doc.moveDown(0.5);

          // Description with colored header
          if (workSummaryData.summaryDescription) {
            doc.fontSize(14).font(fonts.bold).fillColor('#a855f7');
            addText('Opis zestawienia:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            addText(workSummaryData.summaryDescription, 12);
            doc.moveDown(1);
          }

          // Project details with colored header
          doc.fontSize(14).font(fonts.bold).fillColor('#3b82f6');
          addText('Szczegóły projektu:', 14);
          doc.font(fonts.regular).fillColor('#000000');
          addText(`Okres realizacji: ${workSummaryData.periodStart} - ${workSummaryData.periodEnd}`, 12);
          addText(`Status: ${workSummaryData.status}`, 12);
          doc.moveDown(1);

          // Completed tasks
          if (workSummaryData.completedTasks && workSummaryData.completedTasks.length > 0) {
            doc.fontSize(14).font(fonts.bold).fillColor('#10b981');
            addText('Wykonane zadania:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            workSummaryData.completedTasks.forEach((task, index) => {
              if (task.name) {
                addText(`${index + 1}. ${task.name}`, 12);
                if (task.description) {
                  addText(`   ${task.description}`, 10);
                }
                if (task.date) {
                  addText(`   Data: ${task.date}`, 10);
                }
              }
            });
            doc.moveDown(1);
          }

          // Statistics
          if (workSummaryData.statistics && workSummaryData.statistics.length > 0) {
            doc.fontSize(14).font(fonts.bold).fillColor('#f59e0b');
            addText('Statystyki projektu:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            workSummaryData.statistics.forEach(stat => {
              if (stat.label && stat.value) {
                addText(`• ${stat.label}: ${stat.value}`, 12);
              }
            });
            doc.moveDown(1);
          }

          // Achievements
          if (workSummaryData.achievements && workSummaryData.achievements.length > 0) {
            doc.fontSize(14).font(fonts.bold).fillColor('#8b5cf6');
            addText('Osiągnięcia:', 14);
            doc.font(fonts.regular).fillColor('#000000');
            workSummaryData.achievements.forEach((achievement, index) => {
              if (achievement.name) {
                addText(`${index + 1}. ${achievement.name}`, 12);
                if (achievement.description) {
                  addText(`   ${achievement.description}`, 10);
                }
              }
            });
            doc.moveDown(1);
          }

          // Footer with branding
          doc.moveDown(1);
          doc.fillColor('#cccccc')
            .rect(50, doc.y, 500, 1)
            .fill();
          doc.y += 10;
          
          // Company name with colors
          doc.fontSize(14).font(fonts.bold);
          
          const footerSoft = doc.widthOfString('Soft');
          
          doc.fillColor('#3B82F6')
            .text('Soft', 50, doc.y);
          doc.fillColor('#A855F7')
            .text('Synergy', 50 + footerSoft, doc.y);
          
          doc.y += 20;
          doc.fontSize(10).font(fonts.regular).fillColor('#666666');
          const contactY2 = doc.y;
          doc.text('Kontakt: jakub.czajka@soft-synergy.com | +48 793 868 886', 50, contactY2, {
            width: 500
          });
          // Signature aligned with contact line (work summary)
          try {
            const signaturePath = path.join(__dirname, '../../Podpis.jpg');
            if (require('fs').existsSync(signaturePath)) {
              const sigWidth = 280; // 2x bigger
              const sigX = doc.page.width - doc.page.margins.right - sigWidth;
              const sigY = contactY2 - 10;
              doc.image(signaturePath, sigX, sigY, { width: sigWidth });
            }
          } catch (e) {}
          
          doc.y += 15;
          doc.text('Innowacyjne rozwiązania programistyczne', 50, doc.y, {
            width: 500
          });

          // Invoices links section (if available)
          doc.moveDown(1.2);
          doc.font(fonts.bold).fontSize(13).fillColor('#000000');
          addText('Faktury dla tego projektu', 13);
          doc.font(fonts.regular).fontSize(11).fillColor('#000000');
          addText('Soft Synergy przemyślało to za Ciebie — jeśli szukasz faktur do tego projektu, znajdziesz je poniżej.', 11);
          doc.moveDown(0.4);
          if (workSummaryData.proformaUrl) {
            doc.fillColor('#1d4ed8');
            doc.text('Pobierz Fakturę Proforma', 50, doc.y, {
              link: `${workSummaryData.baseUrl}${workSummaryData.proformaUrl}`
            });
          }
          if (workSummaryData.vatUrl) {
            doc.fillColor('#1d4ed8');
            doc.text('Pobierz Fakturę VAT', 50, doc.y, {
              link: `${workSummaryData.baseUrl}${workSummaryData.vatUrl}`
            });
          }

          // Review request section with clickable link
          doc.moveDown(1.2);
          doc.font(fonts.bold).fontSize(13).fillColor('#000000');
          addText('Twoja opinia jest dla nas bardzo ważna', 13);
          doc.font(fonts.regular).fontSize(11).fillColor('#000000');
          addText('Jeśli jesteś zadowolony ze współpracy, zostaw proszę krótką opinię o Soft Synergy. To bardzo pomaga nam rosnąć i docierać do nowych klientów.', 11);
          doc.moveDown(0.4);
          doc.fillColor('#1d4ed8');
          doc.text('Wystaw opinię na Google', 50, doc.y, {
            link: 'https://www.google.com/maps/place/Soft+Synergy/data=!4m2!3m1!1s0x0:0xf6e09ce57a8bc115?sa=X&ved=1t:2428&ictx=111'
          });

          doc.end();
          stream.on('finish', resolve);
          stream.on('error', reject);
        } catch (e) {
          reject(e);
        }
      });

      pdfUrl = `/generated-offers/${pdfFileName}`;
      console.log('Work summary PDF generated successfully:', pdfUrl);
    } catch (pdfError) {
      console.error('Work summary PDF generation failed:', pdfError);
      console.error('PDF Error details:', pdfError.message);
    }

    // Inject generated PDF URL into HTML and overwrite file so template can link to PDF
    try {
      workSummaryData.workSummaryPdfUrl = pdfUrl;
      const htmlWithPdf = template(workSummaryData);
      await fs.writeFile(filePath, htmlWithPdf);
    } catch (e) {
      console.log('Failed to rewrite work summary HTML with PDF URL:', e.message);
    }

    // Update project with generated work summary URL
    project.workSummaryUrl = `/generated-offers/${fileName}`;
    if (pdfUrl) {
      project.workSummaryPdfUrl = pdfUrl;
    }
    
    // Try to save to database, but don't fail if it doesn't work (for local testing)
    try {
      await project.save();
      console.log('Project saved to database successfully');
    } catch (dbError) {
      console.log('Database save failed (local testing mode):', dbError.message);
      // Continue anyway - we'll return the URLs in response
    }

    // Log activity
    try {
      await Activity.create({
        action: 'work-summary.generated',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `Work summary generated for project "${project.name}"`,
        metadata: { workSummaryUrl: `/generated-offers/${fileName}` }
      });
    } catch (e) {
      // ignore logging errors
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      message: 'Zestawienie pracy zostało wygenerowane pomyślnie',
      workSummaryUrl: `/generated-offers/${fileName}`,
      workSummaryPdfUrl: pdfUrl,
      project: project
    });

  } catch (error) {
    console.error('Generate work summary error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania zestawienia pracy' });
  }
});

// Document upload routes
router.post('/upload-document/:projectId', auth, upload.single('document'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Nie wybrano pliku' });
    }

    const { documentType } = req.body;
    
    if (!documentType || !['proforma', 'vat'].includes(documentType)) {
      return res.status(400).json({ message: 'Nieprawidłowy typ dokumentu' });
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../uploads/documents');
    await fs.mkdir(uploadDir, { recursive: true });

    const document = {
      type: documentType,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: `/uploads/documents/${req.file.filename}`,
      fileSize: req.file.size,
      uploadedBy: req.user._id
    };

    project.documents.push(document);
    await project.save();

    // Log activity
    try {
      await Activity.create({
        action: 'document.uploaded',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `Document uploaded: ${documentType} - ${req.file.originalname}`,
        metadata: { documentType, fileName: req.file.originalname }
      });
    } catch (e) {
      // ignore logging errors
    }

    res.json({
      message: 'Dokument został przesłany pomyślnie',
      document: document
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas przesyłania dokumentu' });
  }
});

// Delete document
router.delete('/delete-document/:projectId/:documentId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    const document = project.documents.id(req.params.documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Dokument nie został znaleziony' });
    }

    // Delete file from filesystem
    try {
      const filePath = path.join(__dirname, '..', document.filePath);
      await fs.unlink(filePath);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Continue even if file deletion fails
    }

    // Remove document from project
    project.documents.pull(req.params.documentId);
    await project.save();

    // Log activity
    try {
      await Activity.create({
        action: 'document.deleted',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `Document deleted: ${document.type} - ${document.originalName}`,
        metadata: { documentType: document.type, fileName: document.originalName }
      });
    } catch (e) {
      // ignore logging errors
    }

    res.json({
      message: 'Dokument został usunięty pomyślnie'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania dokumentu' });
  }
});

// Serve uploaded documents
router.get('/documents/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads/documents', req.params.filename);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving document:', err);
      res.status(404).json({ message: 'Dokument nie został znaleziony' });
    }
  });
});

module.exports = router;
 
// Generate contract PDF (from HTML template via Puppeteer) and mark project as accepted
router.post('/generate-contract/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('createdBy', 'firstName lastName email');
    
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    // Create generated-offers directory if it doesn't exist
    const outputDir = path.join(__dirname, '../generated-offers');
    await fs.mkdir(outputDir, { recursive: true });

    // Clean old contract PDFs for this project
    try {
      const existingFiles = await fs.readdir(outputDir);
      const projectFiles = existingFiles.filter(file => file.startsWith(`contract-${project._id}-`) && file.endsWith('.pdf'));
      for (const oldFile of projectFiles) {
        await fs.unlink(path.join(outputDir, oldFile));
      }
    } catch (e) {
      console.error('Contract cleanup error:', e);
    }

    // Generate PDF with pdfkit (works on Linux servers, no headless browser)
    const PDFDocument = require('pdfkit');
    const currency = (n) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n || 0);
    const pdfFileName = `contract-${project._id}-${Date.now()}.pdf`;
    const pdfPath = path.join(outputDir, pdfFileName);
    const customText = typeof req.body?.customText === 'string' ? req.body.customText.trim() : '';

    await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margins: { top: 56, left: 56, right: 56, bottom: 56 } });
        const stream = require('fs').createWriteStream(pdfPath);
        doc.pipe(stream);

        // Register Unicode fonts (system DejaVu fonts)
        const fonts = setupUnicodeFonts(doc);

        // Title
        doc.font(fonts.bold).fontSize(18).text(`Umowa realizacji ${project.name}`, { align: 'left' });
        doc.moveDown(0.5);
        doc.font(fonts.regular).fontSize(11).fillColor('#333').text(`zawarta w dniu ${new Date().toLocaleDateString('pl-PL')} pomiędzy:`);

        // Parties
        doc.moveDown(0.8);
        doc.fillColor('#000').font(fonts.bold).fontSize(12).text('Jakub Czajka');
        doc.font(fonts.regular).fontSize(11).text('zamieszkały w Zielonej Górze na ulicy Rydza-Śmigłego 20/9 65-610,');
        doc.text('identyfikującym się dowodem osobistym o numerze seryjnym DAJ 798974 oraz o numerze PESEL 07302001359,');
        doc.text('działający w ramach marki Soft Synergy');
        doc.moveDown(0.6);
        doc.text('a');
        doc.moveDown(0.6);
        doc.font(fonts.bold).text('[Dane Klienta]');
        // Dotted area for client data input (with extra spacing to avoid overlap)
        const startX = doc.page.margins.left;
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        let y = doc.y + 12; // push below current text
        const gap = 18;
        doc.dash(3, { space: 4 }).strokeColor('#bdbdbd').lineWidth(1);
        doc.moveTo(startX, y).lineTo(startX + width, y).stroke();
        y += gap;
        doc.moveTo(startX, y).lineTo(startX + width, y).stroke();
        y += gap;
        doc.moveTo(startX, y).lineTo(startX + width, y).stroke();
        doc.undash().strokeColor('#000');
        // move cursor below dotted block with safe margin
        doc.y = y + 16;
        doc.font(fonts.regular).text('zwana dalej „Zamawiającym"');

        // Rule
        doc.moveDown(0.6);
        doc.strokeColor('#999').lineWidth(2).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

        const sectionHeader = (title) => {
          doc.moveDown(1);
          doc.font(fonts.bold).fontSize(13).fillColor('#000').text(title);
        };
        const bulletList = (items) => {
          doc.moveDown(0.2);
          doc.font(fonts.regular).fontSize(11).fillColor('#000');
          items.forEach((t, idx) => {
            doc.text(`${idx + 1}. ${t}`, { indent: 14 });
          });
        };

        // §1
        sectionHeader('§1. Przedmiot umowy');
        const offerDate = project.createdAt
          ? new Date(project.createdAt).toLocaleDateString('pl-PL')
          : new Date().toLocaleDateString('pl-PL');
        doc.font(fonts.regular).fontSize(11).text(`Wykonawca zobowiązuje się do realizacji projektu "${project.name}" zgodnie z zakresem opisanym w Załączniku nr 1 (oferta z dnia ${offerDate}).`);

        // §2
        sectionHeader('§2. Zakres prac');
        const modules = Array.isArray(project.modules) && project.modules.length ? project.modules.map(m => `${m.name}: ${m.description}`) : ['Zakres zgodnie z ofertą'];
        bulletList(modules);

        // §3 – Harmonogram z danych projektu
        sectionHeader('§3. Harmonogram i czas realizacji');
        const timelineBullets = [];
        if (project.timeline?.phase1) timelineBullets.push(`${project.timeline.phase1.name}: ${project.timeline.phase1.duration}`);
        if (project.timeline?.phase2) timelineBullets.push(`${project.timeline.phase2.name}: ${project.timeline.phase2.duration}`);
        if (project.timeline?.phase3) timelineBullets.push(`${project.timeline.phase3.name}: ${project.timeline.phase3.duration}`);
        if (project.timeline?.phase4) timelineBullets.push(`${project.timeline.phase4.name}: ${project.timeline.phase4.duration}`);
        if (timelineBullets.length) {
          bulletList(timelineBullets);
        }
        doc.moveDown(0.2);
        doc.font(fonts.regular).fontSize(11).fillColor('#000');
        doc.text(`* Prace rozpoczną się w ciągu 3 dni roboczych od odesłania podpisanej umowy.`, { indent: 14 });

        // §4 – Wynagrodzenie i płatności dynamicznie
        sectionHeader('§4. Wynagrodzenie i płatności');
        const total = currency(project?.pricing?.total || 0);
        doc.font(fonts.regular).fontSize(11).text(`Łączne wynagrodzenie za realizację prac wynosi ${total} netto.`);
        doc.moveDown(0.2);
        const paymentLines = (project.customPaymentTerms && project.customPaymentTerms.trim().length)
          ? project.customPaymentTerms.split(/\n+/)
          : [
              `Faza I: ${currency(project?.pricing?.phase1 || 0)}`,
              `Faza II: ${currency(project?.pricing?.phase2 || 0)}`,
              `Faza III: ${currency(project?.pricing?.phase3 || 0)}`,
              `Faza IV: ${currency(project?.pricing?.phase4 || 0)}`
            ].filter(line => !line.endsWith('0,00 zł') && !line.endsWith('0,00 zł'));
        if (paymentLines.length) {
          doc.text('Warunki płatności:');
          paymentLines.forEach(t => doc.text(`• ${t}`, { indent: 14 }));
        }
        doc.moveDown(0.2);
        doc.text('Faktury VAT za powyższe kwoty wystawi firma:');
        doc.moveDown(0.2);
        doc.font(fonts.bold).text('FUNDACJA AIP');
        doc.font(fonts.regular).text('NIP: 5242495143');
        doc.text('ul. ALEJA KSIĘCIA JÓZEFA PONIATOWSKIEGO 1/ — 03-901');
        doc.text('WARSZAWA MAZOWIECKIE');
        doc.text('email: jakub.czajka@soft-synergy.com');
        doc.text('Numer telefonu: +48 793 868 886');
        doc.text('jako podmiot świadczący usługę na rzecz Wykonawcy.');
        doc.moveDown(0.2);
        doc.text('Płatność faktur będzie traktowana jako spełnienie zobowiązania wobec Wykonawcy.');

        // §5
        sectionHeader('§5. Zwrot zaliczki i odstąpienie');
        bulletList([
          'W przypadku niemożliwości realizacji projektu z przyczyn niezależnych od Wykonawcy, Wykonawca może odstąpić od umowy i zobowiązuje się do pełnego zwrotu zaliczki w terminie do 5 dni roboczych.',
          'W takim przypadku żadna ze stron nie będzie dochodziła dalszych roszczeń.'
        ]);

        // §6
        sectionHeader('§6. Odbiór i gwarancja');
        bulletList([
          'Zamawiający zobowiązuje się do odbioru prac po zakończeniu realizacji.',
          'Błędy zgłoszone w okresie 3 miesięcy od odbioru będą poprawiane nieodpłatnie.',
          'Gwarancja nie obejmuje zmian funkcjonalnych ani rozbudowy.'
        ]);

        // §7
        sectionHeader('§7. Postanowienia końcowe');
        bulletList([
          'Strony dopuszczają kontakt i ustalenia drogą mailową jako formę wiążącą.',
          'Spory będą rozstrzygane polubownie, a w razie potrzeby przez sąd właściwy dla miejsca zamieszkania Wykonawcy.',
          'W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego.'
        ]);

        // Signatures
        doc.moveDown(2);
        const yStart = doc.y;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const colWidth = pageWidth / 2 - 10;
        // Left
        doc.moveTo(doc.page.margins.left, yStart + 30).lineTo(doc.page.margins.left + colWidth, yStart + 30).strokeColor('#000').lineWidth(1).stroke();
        doc.font(fonts.regular).fontSize(10).text('Zamawiający', doc.page.margins.left, yStart + 35, { width: colWidth, align: 'left' });
        // Right
        const rightX = doc.page.margins.left + colWidth + 20;
        const lineY = yStart + 30;
        doc.moveTo(rightX, lineY).lineTo(rightX + colWidth, lineY).stroke();
        // Signature image (2x bigger, placed below the line, offset by 25px)
        try {
          const sigPath = path.join(__dirname, '../public/img/podpis-jakub-czajka.jpg');
          const sigWidth = 240; // 2x bigger
          const sigX = rightX + colWidth - sigWidth;
          const sigY = lineY + 25; // 25px below the line to avoid overlap
          doc.image(sigPath, sigX, sigY, { width: sigWidth, align: 'right' });
        } catch (e) {
          // ignore if image not found
        }
        // Place caption under the signature image
        doc.font(fonts.regular).text('Jakub Czajka\ndziałający w ramach marki Soft Synergy', rightX, lineY + 25 + 70, { width: colWidth, align: 'right' });

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });

    // Save on project and mark accepted
    project.contractPdfUrl = `/generated-offers/${pdfFileName}`;
    project.status = 'accepted';
    await project.save();

    // Log activity
    try {
      await Activity.create({
        action: 'contract.generated',
        entityType: 'project',
        entityId: project._id,
        author: req.user._id,
        message: `Contract generated and project accepted: "${project.name}"`,
        metadata: { contractPdfUrl: project.contractPdfUrl }
      });
    } catch (e) {}

    // Response with URLs
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    return res.json({
      message: 'Umowa została wygenerowana, status ustawiono na zaakceptowany',
      contractPdfUrl: project.contractPdfUrl,
      project
    });
  } catch (error) {
    console.error('Generate contract error:', error);
    return res.status(500).json({ message: 'Błąd serwera podczas generowania umowy' });
  }
});

// Return an editable draft of the contract text before PDF generation
router.get('/contract-draft/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Projekt nie został znaleziony' });
    }

    const currency = (n) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n || 0);

    const lines = [];
    lines.push(`Umowa realizacji ${project.name}`);
    lines.push(`zawarta w dniu ${new Date().toLocaleDateString('pl-PL')} pomiędzy:`);
    lines.push(`Jakub Czajka, działający w ramach marki Soft Synergy`);
    lines.push('a');
    lines.push('[Dane Klienta]');
    lines.push('zwana dalej „Zamawiającym”');
    lines.push('');
    lines.push('§1. Przedmiot umowy');
    lines.push(`Wykonawca zobowiązuje się do realizacji projektu "${project.name}", zgodnie z zakresem opisanym w Załączniku nr 1 (oferta z dnia ${new Date().toLocaleDateString('pl-PL')}).`);
    lines.push('');
    lines.push('§2. Zakres prac');
    const modules = Array.isArray(project.modules) && project.modules.length ? project.modules : [{ name: 'Zakres', description: 'zgodnie z ofertą' }];
    modules.forEach((m, i) => lines.push(`${i + 1}. ${m.name}: ${m.description}`));
    lines.push('');
    lines.push('§3. Harmonogram i czas realizacji');
    if (project.timeline?.phase1) lines.push(`- ${project.timeline.phase1.name}: ${project.timeline.phase1.duration}`);
    if (project.timeline?.phase2) lines.push(`- ${project.timeline.phase2.name}: ${project.timeline.phase2.duration}`);
    if (project.timeline?.phase3) lines.push(`- ${project.timeline.phase3.name}: ${project.timeline.phase3.duration}`);
    if (project.timeline?.phase4) lines.push(`- ${project.timeline.phase4.name}: ${project.timeline.phase4.duration}`);
    lines.push('- Prace rozpoczną się w ciągu 3 dni roboczych od odesłania podpisanej umowy.');
    lines.push('');
    lines.push('§4. Wynagrodzenie i płatności');
    lines.push(`Łączne wynagrodzenie za realizację prac wynosi ${currency(project?.pricing?.total || 0)} netto.`);
    const paymentLines = (project.customPaymentTerms && project.customPaymentTerms.trim().length)
      ? project.customPaymentTerms.split(/\n+/)
      : [
          `Faza I: ${currency(project?.pricing?.phase1 || 0)}`,
          `Faza II: ${currency(project?.pricing?.phase2 || 0)}`,
          `Faza III: ${currency(project?.pricing?.phase3 || 0)}`,
          `Faza IV: ${currency(project?.pricing?.phase4 || 0)}`
        ];
    paymentLines.forEach((l) => lines.push(`- ${l}`));
    lines.push('');
    lines.push('§5. Zwrot zaliczki i odstąpienie');
    lines.push('1. W przypadku niemożliwości realizacji projektu z przyczyn niezależnych od Wykonawcy, Wykonawca może odstąpić od umowy i zobowiązuje się do pełnego zwrotu zaliczki w terminie do 5 dni roboczych.');
    lines.push('2. W przypadku odstąpienia od umowy przez Zamawiającego po rozpoczęciu prac, zaliczka nie podlega zwrotowi i zostaje zatrzymana przez Wykonawcę na poczet już wykonanych prac.');
    lines.push('');
    lines.push('§6. Odbiór i gwarancja');
    lines.push('1. Zamawiający zobowiązuje się do odbioru prac po zakończeniu realizacji.');
    lines.push('2. Błędy zgłoszone w okresie 3 miesięcy od odbioru będą poprawiane nieodpłatnie.');
    lines.push('3. Gwarancja nie obejmuje zmian funkcjonalnych ani rozbudowy.');
    lines.push('');
    // Dodajemy nowy paragraf dotyczący spotkań i kary umownej
    lines.push('§7. Spotkania projektowe i kara umowna');
    lines.push('1. Strony mogą umawiać się na spotkania dotyczące realizacji projektu w formie zdalnej.');
    lines.push('2. Ustalenie terminu spotkania następuje za zgodą obu stron, z wyprzedzeniem co najmniej 24 godzin.');
    lines.push('3. W przypadku nieobecności Zamawiającego na umówionym spotkaniu bez wcześniejszego odwołania (najpóźniej 2 godziny przed spotkaniem), Zamawiający zobowiązuje się do zapłaty kary umownej w wysokości 100,00 zł za każde takie zdarzenie.');
    lines.push('');
    lines.push('§8. Postanowienia końcowe');
    lines.push('1. Strony dopuszczają kontakt i ustalenia drogą mailową jako formę wiążącą.');
    lines.push('2. Spory będą rozstrzygane polubownie, a w razie potrzeby przez sąd właściwy dla miejsca zamieszkania Wykonawcy.');
    lines.push('3. W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego.');

    res.json({ draft: lines.join('\n') });
  } catch (error) {
    console.error('Contract draft error:', error);
    res.status(500).json({ message: 'Błąd serwera podczas generowania szkicu umowy' });
  }
});