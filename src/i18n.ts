import type { Language } from './types.ts';

export const UI_STRINGS: Record<
  Language,
  {
    appName: string;
    welcomeTitle: string;
    welcomeSubtitle: string;
    startVoiceBtn: string;
    openAssistantBtn: string;
    navDashboard: string;
    navAssistant: string;
    navKnowledge: string;
    navWeatherMandi: string;
    navAdmin: string;
    weatherSummaryTitle: string;
    mandiSummaryTitle: string;
    quickQuestionsTitle: string;
    viewAllWeather: string;
    viewAllMandi: string;
    askPlaceholder: string;
    sendBtn: string;
    recordStart: string;
    recordStop: string;
    recordingNow: string;
    transcribing: string;
    thinking: string;
    listenAnswer: string;
    stopAudio: string;
    sourcesTitle: string;
    pageLabel: string;
    helpfulQuestion: string;
    refusedBanner: string;
    lastUpdated: string;
    suggestedQuestions: Array<{ label: string; query: string; tag: string }>;
  }
> = {
  mr: {
    appName: 'KrishiMitra AI',
    welcomeTitle: 'शेतकऱ्यांसाठी विश्वासार्ह आवाज-आधारित कृषी सहाय्यक',
    welcomeSubtitle:
      'मराठी, हिंदी आणि इंग्रजीमध्ये शेती, कीड नियंत्रण, सरकारी योजना, हवामान आणि बाजारभावाबद्दल थेट प्रश्न विचारा — प्रत्येक उत्तर प्रमाणित दस्तऐवज आणि संदर्भांसह.',
    startVoiceBtn: 'आवाजात प्रश्न विचारा',
    openAssistantBtn: 'सहाय्यक उघडा',
    navDashboard: 'मुख्यपृष्ठ',
    navAssistant: 'कृषी सहाय्यक',
    navKnowledge: 'दस्तऐवज केंद्र',
    navWeatherMandi: 'हवामान व मंडी',
    navAdmin: 'प्रशासन व मूल्यमापन',
    weatherSummaryTitle: 'थेट कृषी हवामान सारांश',
    mandiSummaryTitle: 'आजचे मंडी बाजारभाव सारांश',
    quickQuestionsTitle: 'त्वरित शेती विषयक प्रश्न',
    viewAllWeather: 'पूर्ण हवामान पहा',
    viewAllMandi: 'सर्व बाजारभाव पहा',
    askPlaceholder: 'तुमचा शेती विषयक प्रश्न येथे लिहा किंवा माइक दाबून बोला...',
    sendBtn: 'पाठवा',
    recordStart: 'बोला (Mic)',
    recordStop: 'रेकॉर्डिंग थांबवा',
    recordingNow: 'आवाज रेकॉर्ड होत आहे...',
    transcribing: 'आवाज ओळखत आहे...',
    thinking: 'प्रमाणित माहिती शोधत आहे...',
    listenAnswer: 'उत्तर ऐका',
    stopAudio: 'थांबवा',
    sourcesTitle: 'संदर्भ व पुरावे',
    pageLabel: 'पान क्र.',
    helpfulQuestion: 'हे उत्तर उपयुक्त ठरले का?',
    refusedBanner: 'सुरक्षित नकार — पुरेसा प्रमाणित पुरावा उपलब्ध नाही',
    lastUpdated: 'अद्ययावत वेळ',
    suggestedQuestions: [
      {
        label: 'कापसाची पाने पिवळी पडणे',
        query: 'माझ्या कापसाच्या पिकाची पाने पिवळी पडत आहेत, काय करावे?',
        tag: 'पीक व कीड सल्ला',
      },
      {
        label: 'गहू लागवड पद्धत',
        query: 'What is the recommended practice for growing wheat?',
        tag: 'लागवड तंत्रज्ञान',
      },
      {
        label: 'सोयाबीन पिकाची काळजी',
        query: 'सोयाबीन पिकासाठी कोणती काळजी घ्यावी?',
        tag: 'खरीप मार्गदर्शन',
      },
      {
        label: 'शेतकरी सरकारी योजना',
        query: 'शेतकऱ्यांसाठी कोणकोणत्या सरकारी योजना उपलब्ध आहेत?',
        tag: 'योजना व विमा',
      },
    ],
  },
  hi: {
    appName: 'KrishiMitra AI',
    welcomeTitle: 'भारतीय किसानों के लिए विश्वसनीय वॉइस-फर्स्ट कृषि सहायक',
    welcomeSubtitle:
      'मराठी, हिंदी और अंग्रेजी में फसल सलाह, कीट प्रबंधन, सरकारी योजनाओं, मौसम और मंडी भाव के प्रश्न पूछें — हर उत्तर सत्यापित स्रोतों के साथ।',
    startVoiceBtn: 'आवाज़ से प्रश्न पूछें',
    openAssistantBtn: 'सहायक खोलें',
    navDashboard: 'डैशबोर्ड',
    navAssistant: 'कृषि सहायक',
    navKnowledge: 'दस्तावेज़ केंद्र',
    navWeatherMandi: 'मौसम व मंडी',
    navAdmin: 'प्रशासन व मूल्यांकन',
    weatherSummaryTitle: 'लाइव कृषि मौसम सारांश',
    mandiSummaryTitle: 'आज के मंडी भाव सारांश',
    quickQuestionsTitle: 'त्वरित कृषि प्रश्न',
    viewAllWeather: 'पूरा मौसम देखें',
    viewAllMandi: 'सभी मंडी भाव देखें',
    askPlaceholder: 'अपना कृषि प्रश्न यहां लिखें या माइक दबाकर बोलें...',
    sendBtn: 'भेजें',
    recordStart: 'बोलें (Mic)',
    recordStop: 'रिकॉर्डिंग रोकें',
    recordingNow: 'आवाज़ रिकॉर्ड हो रही है...',
    transcribing: 'आवाज़ को टेक्स्ट में बदल रहे हैं...',
    thinking: 'सत्यापित दस्तावेज़ों में खोज रहे हैं...',
    listenAnswer: 'उत्तर सुनें',
    stopAudio: 'रोकें',
    sourcesTitle: 'सत्यापित स्रोत व संदर्भ',
    pageLabel: 'पृष्ठ',
    helpfulQuestion: 'क्या यह उत्तर उपयोगी था?',
    refusedBanner: 'सुरक्षित अस्वीकृति — पर्याप्त सत्यापित प्रमाण उपलब्ध नहीं',
    lastUpdated: 'अद्यतन समय',
    suggestedQuestions: [
      {
        label: 'कपास की पत्तियां पीली पड़ना',
        query: 'माझ्या कापसाच्या पिकाची पाने पिवळी पडत आहेत, काय करावे?',
        tag: 'फसल व कीट सलाह',
      },
      {
        label: 'गेहूं की खेती के तरीके',
        query: 'What is the recommended practice for growing wheat?',
        tag: 'खेती तकनीक',
      },
      {
        label: 'सोयाबीन फसल की देखभाल',
        query: 'सोयाबीन की फसल के लिए क्या सावधानी और देखभाल करनी चाहिए?',
        tag: 'खरीफ सलाह',
      },
      {
        label: 'किसान सरकारी योजनाएं',
        query: 'किसानों के लिए कौन सी सरकारी योजनाएं उपलब्ध हैं?',
        tag: 'योजनाएं व बीमा',
      },
    ],
  },
  en: {
    appName: 'KrishiMitra AI',
    welcomeTitle: 'Trustworthy Voice-First Agricultural Assistant for Indian Farmers',
    welcomeSubtitle:
      'Ask questions by voice or text in Marathi, Hindi, and English. Every answer is grounded in verified agricultural documents, live Open-Meteo weather, and transparent market rates.',
    startVoiceBtn: 'Ask with Voice',
    openAssistantBtn: 'Open Assistant',
    navDashboard: 'Dashboard',
    navAssistant: 'Assistant',
    navKnowledge: 'Knowledge Base',
    navWeatherMandi: 'Weather & Mandi',
    navAdmin: 'Admin & Eval',
    weatherSummaryTitle: 'Live Agromet Weather',
    mandiSummaryTitle: "Today's Mandi Prices",
    quickQuestionsTitle: 'Quick Farmer Questions',
    viewAllWeather: 'Full Weather Forecast',
    viewAllMandi: 'Explore Mandi Rates',
    askPlaceholder: 'Type your farming question or press the microphone to speak...',
    sendBtn: 'Send',
    recordStart: 'Speak',
    recordStop: 'Stop Recording',
    recordingNow: 'Recording voice...',
    transcribing: 'Transcribing speech...',
    thinking: 'Searching verified advisories...',
    listenAnswer: 'Listen',
    stopAudio: 'Stop',
    sourcesTitle: 'Verified Sources & Passages',
    pageLabel: 'Page',
    helpfulQuestion: 'Was this answer helpful?',
    refusedBanner: 'Safe Refusal — Insufficient Verified Evidence',
    lastUpdated: 'Last updated',
    suggestedQuestions: [
      {
        label: 'Cotton yellowing leaves (Marathi)',
        query: 'माझ्या कापसाच्या पिकाची पाने पिवळी पडत आहेत, काय करावे?',
        tag: 'Pest & Crop Health',
      },
      {
        label: 'Wheat cultivation practices',
        query: 'What is the recommended practice for growing wheat?',
        tag: 'Crop Advisory',
      },
      {
        label: 'Soybean crop care (Marathi)',
        query: 'सोयाबीन पिकासाठी कोणती काळजी घ्यावी?',
        tag: 'Kharif Practice',
      },
      {
        label: 'Government schemes for farmers',
        query: 'What government schemes are available for farmers?',
        tag: 'Schemes & Insurance',
      },
    ],
  },
};
