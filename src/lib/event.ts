export const event = {
  graduateName: "Annachiara Soldivieri",
  degree: "Lingue, Letterature e Culture dell'Europa e delle Americhe",
  dateLabel: "27 luglio 2026",
  timeLabel: "Subito dopo la proclamazione, in mattinata",
  venueName: "O' Scemo Centro Storico",
  venueAddress: "Via Francesco de Sanctis, Via Nilo, 1, 80134 Napoli NA",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=O%27%20Scemo%20Centro%20Storico%20Via%20Francesco%20de%20Sanctis%20Via%20Nilo%201%2080134%20Napoli",
  rsvpDeadline: "2026-07-20",
  rsvpDeadlineLabel: "20 luglio 2026",
  contactPhone: "3282525024"
};

export type QuizQuestion =
  | {
      id: string;
      type: "choice";
      question: string;
      options: string[];
      correctAnswer: string;
    }
  | {
      id: string;
      type: "text";
      question: string;
      acceptedAnswers: string[];
      placeholder: string;
    };

export const quizQuestions: QuizQuestion[] = [
  {
    id: "disney",
    type: "choice",
    question: "Qual era, ed e ancora, la mia serie TV Disney preferita?",
    options: ["Violetta", "Soy Luna", "Flor"],
    correctAnswer: "Violetta"
  },
  {
    id: "cantante",
    type: "choice",
    question: "Qual e il mio cantante preferito?",
    options: ["Bad Bunny", "Justin Bieber", "Ultimo"],
    correctAnswer: "Bad Bunny"
  },
  {
    id: "zona-napoli",
    type: "choice",
    question: "Come si chiama la zona dove vivevo a Napoli?",
    options: ["Materdei", "Salvator Rosa", "Quattro giornate"],
    correctAnswer: "Materdei"
  },
  {
    id: "filologia-romanza",
    type: "choice",
    question: "Quante volte ho ridato l'esame di filologia romanza?",
    options: ["1", "2", "0", "Passato subito"],
    correctAnswer: "2"
  },
  {
    id: "coniglietto",
    type: "choice",
    question: "Come si chiamava il mio coniglietto?",
    options: ["Amo", "Luna", "Nuvola"],
    correctAnswer: "Amo"
  },
  {
    id: "gatto",
    type: "choice",
    question: "Come si chiama il mio gatto?",
    options: ["Salem", "Milo", "Romeo"],
    correctAnswer: "Salem"
  }
];
