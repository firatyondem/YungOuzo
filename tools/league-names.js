// Name and biography data for the fictional league (used by tools/gen-league.js
// and checked by tests/league-names.test.js).
// Rules: every player has one nationality; first name and surname both come from
// that nationality's pool (never mixed); names are common ones; the birthplace is
// a real city of that country. Nothing here is meant to refer to a real athlete:
// REAL_NAMES lists first+surname pairs that are known real athletes or public
// figures, and the generator never produces them.

export const NATIONS = {
  Serbian: {
    tones: [1, 2, 3],
    first: ["Nikola", "Marko", "Stefan", "Milan", "Dušan", "Nemanja", "Vuk", "Ognjen"],
    last: ["Jovanović", "Petrović", "Marković", "Stojanović", "Pavlović", "Ilić", "Lazić", "Živković"],
    cities: ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Čačak", "Subotica"],
  },
  Croatian: {
    tones: [1, 2, 3],
    first: ["Ivan", "Josip", "Ante", "Mate", "Karlo", "Toni", "Dino", "Marin"],
    last: ["Horvat", "Kovačević", "Babić", "Marić", "Jurić", "Vuković", "Knežević", "Perić"],
    cities: ["Zagreb", "Split", "Zadar", "Rijeka", "Šibenik", "Osijek"],
  },
  Slovenian: {
    tones: [1, 2],
    first: ["Žiga", "Jaka", "Matic", "Aljaž", "Gregor", "Rok", "Miha", "Tilen"],
    last: ["Novak", "Kovačič", "Zupančič", "Potočnik", "Kralj", "Golob", "Mlakar", "Kos"],
    cities: ["Ljubljana", "Maribor", "Celje", "Koper", "Kranj", "Novo Mesto"],
  },
  Greek: {
    tones: [2, 3, 4],
    first: ["Giorgos", "Kostas", "Nikos", "Dimitris", "Vasilis", "Thanasis", "Panagiotis", "Stavros"],
    last: ["Papadopoulos", "Georgiou", "Nikolaidis", "Karagiannis", "Dimitriou", "Vlachos", "Makris", "Antoniou"],
    cities: ["Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa", "Volos"],
  },
  Turkish: {
    tones: [2, 3, 4],
    first: ["Emre", "Kerem", "Burak", "Mert", "Can", "Onur", "Yiğit", "Deniz"],
    last: ["Yılmaz", "Demir", "Aydın", "Kaya", "Çelik", "Şahin", "Arslan", "Koç"],
    cities: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana"],
  },
  Spanish: {
    tones: [2, 3, 4],
    first: ["Pablo", "Javier", "Sergio", "Álvaro", "Diego", "Raúl", "Iván", "Adrián"],
    last: ["García", "Martínez", "Ruiz", "Navarro", "Romero", "Serrano", "Molina", "Ortega"],
    cities: ["Madrid", "Barcelona", "Valencia", "Seville", "Málaga", "Zaragoza", "Bilbao"],
  },
  French: {
    tones: [1, 2, 3, 4, 5, 6],
    first: ["Antoine", "Hugo", "Lucas", "Théo", "Maxime", "Julien", "Bastien", "Clément"],
    last: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Girard", "Roux", "Fournier"],
    cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Nantes", "Strasbourg", "Lille"],
  },
  Italian: {
    tones: [2, 3],
    first: ["Marco", "Luca", "Matteo", "Andrea", "Davide", "Simone", "Alessandro", "Riccardo"],
    last: ["Rossi", "Bianchi", "Ferrari", "Romano", "Colombo", "Ricci", "Conti", "Gallo"],
    cities: ["Milan", "Rome", "Bologna", "Naples", "Turin", "Venice", "Trieste"],
  },
  German: {
    tones: [1, 2],
    first: ["Lukas", "Jonas", "Felix", "Maximilian", "Niklas", "Paul", "Moritz", "Leon"],
    last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann"],
    cities: ["Berlin", "Munich", "Hamburg", "Bamberg", "Ulm", "Bonn", "Frankfurt"],
  },
  Lithuanian: {
    tones: [1, 2],
    first: ["Mantas", "Tomas", "Lukas", "Rokas", "Paulius", "Edgaras", "Martynas", "Domantas"],
    last: ["Kazlauskas", "Petrauskas", "Jankauskas", "Stankevičius", "Vasiliauskas", "Butkus", "Urbonas", "Navickas"],
    cities: ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus"],
  },
  Latvian: {
    tones: [1, 2],
    first: ["Jānis", "Artūrs", "Mārtiņš", "Roberts", "Edgars", "Rihards", "Toms", "Emīls"],
    last: ["Bērziņš", "Kalniņš", "Ozoliņš", "Liepiņš", "Krūmiņš", "Jansons", "Zariņš", "Balodis"],
    cities: ["Riga", "Liepāja", "Ventspils", "Daugavpils", "Jelgava", "Valmiera"],
  },
  Israeli: {
    tones: [2, 3, 4],
    first: ["Yonatan", "Omer", "Itay", "Noam", "Amit", "Tomer", "Idan", "Guy"],
    last: ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Friedman", "Avraham", "Shapira"],
    cities: ["Tel Aviv", "Jerusalem", "Haifa", "Holon", "Rishon LeZion", "Be'er Sheva"],
  },
  Senegalese: {
    tones: [5, 6],
    first: ["Mamadou", "Cheikh", "Ibrahima", "Moussa", "Abdoulaye", "Ousmane", "Pape", "Modou"],
    last: ["Diop", "Ndiaye", "Fall", "Sow", "Diallo", "Gueye", "Sarr", "Mbaye"],
    cities: ["Dakar", "Thiès", "Saint-Louis", "Kaolack", "Ziguinchor"],
  },
  Nigerian: {
    tones: [5, 6],
    first: ["Chinedu", "Emeka", "Tunde", "Obinna", "Segun", "Ifeanyi", "Kelechi", "Babajide"],
    last: ["Okafor", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Nwosu", "Adebayo", "Olawale"],
    cities: ["Lagos", "Abuja", "Ibadan", "Benin City", "Enugu", "Port Harcourt"],
  },
  American: {
    tones: [1, 2, 3, 4, 5, 6],
    first: ["Marcus", "Darius", "Tyrell", "Jalen", "Devon", "Andre", "Malik", "Trevor"],
    last: ["Coleman", "Whitfield", "Holloway", "Pruitt", "Langston", "Mercer", "Hargrove", "Tolliver"],
    cities: ["Atlanta", "Chicago", "Houston", "Memphis", "Oakland", "Baltimore", "Indianapolis"],
  },
};

// First + surname pairs that belong to known real athletes or public figures
// (basketball first, then other sports and public life). Never generated.
export const REAL_NAMES = new Set([
  // Serbian
  "Nikola Jovanović", "Stefan Marković", "Nikola Pavlović", "Milan Jovanović", "Marko Marković", "Nikola Marković", "Stefan Jovanović",
  "Marko Jovanović", "Nikola Petrović", "Marko Petrović", "Stefan Ilić", "Nemanja Jovanović", "Dušan Marković", "Milan Marković", "Nikola Ilić",
  "Marko Pavlović", "Milan Pavlović", "Stefan Stojanović", "Nikola Stojanović", "Dušan Petrović", "Nemanja Petrović", "Marko Stojanović",
  // Croatian
  "Luka Babić", "Ivan Jurić", "Ivan Perić", "Ante Jurić", "Ivan Horvat", "Josip Jurić", "Mate Marić", "Ivan Marić", "Josip Babić", "Toni Perić", "Marin Marić", "Ivan Vuković", "Josip Vuković", "Ivan Babić", "Ivan Knežević", "Dino Perić",
  // Slovenian
  "Rok Kralj", "Žiga Kos", "Gregor Novak", "Miha Novak", "Jaka Novak", "Matic Kralj", "Aljaž Kos", "Rok Golob", "Tilen Kos",
  // Greek
  "Giorgos Georgiou", "Kostas Papadopoulos", "Nikos Papadopoulos", "Giorgos Papadopoulos", "Dimitris Papadopoulos", "Vasilis Papadopoulos", "Nikos Nikolaidis", "Kostas Antoniou", "Nikos Vlachos", "Giorgos Karagiannis", "Giorgos Makris", "Dimitris Nikolaidis", "Thanasis Papadopoulos", "Stavros Georgiou", "Nikos Georgiou", "Panagiotis Papadopoulos",
  // Turkish
  "Burak Yılmaz", "Yiğit Arslan", "Onur Aydın", "Emre Aydın", "Deniz Yılmaz", "Emre Demir", "Burak Çelik", "Emre Çelik", "Kerem Demir", "Mert Yılmaz", "Emre Kaya", "Can Arslan", "Burak Kaya", "Onur Kaya", "Kerem Koç", "Emre Koç", "Mert Çelik", "Deniz Kaya", "Can Yılmaz", "Emre Yılmaz", "Burak Aydın", "Emre Şahin", "Burak Şahin", "Kerem Yılmaz", "Onur Yılmaz", "Burak Demir", "Burak Arslan", "Emre Arslan",
  // Spanish
  "Sergio García", "Javier Martínez", "Raúl García", "Iván Navarro", "Pablo García", "Javier García", "Sergio Romero", "Álvaro Navarro", "Diego García", "Pablo Martínez", "Sergio Ruiz", "Álvaro García", "Raúl Navarro", "Iván Romero", "Diego Martínez", "Sergio Martínez", "Javier Navarro", "Iván García", "Adrián Martínez", "Diego Romero", "Raúl Ruiz", "Pablo Ruiz", "Javier Ruiz", "Iván Martínez", "Adrián Ortega", "Álvaro Martínez", "Raúl Martínez", "Adrián García", "Diego Ortega", "Javier Ortega", "Sergio Molina", "Javier Molina", "Pablo Ortega", "Javier Romero", "Iván Ruiz", "Diego Ruiz",
  // French
  "Julien Bernard", "Hugo Girard", "Antoine Roux", "Lucas Bernard", "Julien Laurent", "Lucas Martin", "Maxime Bernard", "Antoine Martin", "Julien Martin", "Hugo Martin", "Maxime Martin", "Théo Bernard", "Clément Martin", "Bastien Martin", "Julien Fournier", "Antoine Dubois", "Lucas Dubois", "Maxime Dubois", "Julien Moreau", "Clément Moreau", "Antoine Bernard", "Hugo Bernard", "Lucas Laurent",
  // Italian
  "Marco Rossi", "Andrea Conti", "Matteo Ferrari", "Davide Rossi", "Luca Rossi", "Andrea Rossi", "Matteo Rossi", "Simone Rossi", "Alessandro Rossi", "Riccardo Rossi", "Marco Bianchi", "Luca Bianchi", "Andrea Bianchi", "Marco Ferrari", "Andrea Ferrari", "Luca Ferrari", "Marco Romano", "Andrea Romano", "Simone Romano", "Marco Conti", "Luca Conti", "Matteo Conti", "Marco Gallo", "Andrea Gallo", "Luca Gallo", "Simone Colombo", "Andrea Colombo", "Marco Colombo", "Davide Ricci", "Marco Ricci", "Luca Ricci", "Matteo Ricci", "Alessandro Ferrari", "Davide Ferrari", "Alessandro Bianchi", "Davide Bianchi", "Riccardo Ferrari", "Matteo Bianchi", "Alessandro Romano", "Davide Conti", "Simone Bianchi", "Luca Romano", "Matteo Romano", "Andrea Ricci", "Luca Colombo", "Matteo Colombo",
  // German
  "Moritz Wagner", "Felix Hoffmann", "Niklas Schmidt", "Lukas Müller", "Jonas Müller", "Felix Müller", "Paul Müller", "Leon Müller", "Maximilian Müller", "Lukas Schmidt", "Jonas Schmidt", "Paul Schmidt", "Lukas Fischer", "Jonas Fischer", "Felix Schneider", "Jonas Hoffmann", "Maximilian Wagner", "Felix Wagner", "Paul Wagner", "Lukas Becker", "Niklas Müller", "Moritz Müller", "Lukas Wagner", "Jonas Wagner", "Leon Wagner", "Niklas Wagner",
  // Lithuanian
  "Edgaras Jankauskas", "Mantas Kazlauskas", "Tomas Kazlauskas", "Lukas Kazlauskas", "Rokas Kazlauskas", "Paulius Petrauskas", "Tomas Petrauskas", "Mantas Petrauskas", "Lukas Petrauskas", "Tomas Jankauskas", "Mantas Jankauskas", "Paulius Jankauskas", "Martynas Jankauskas", "Tomas Vasiliauskas", "Lukas Vasiliauskas", "Mantas Stankevičius", "Tomas Stankevičius", "Paulius Butkus", "Tomas Butkus", "Mantas Butkus", "Tomas Urbonas", "Tomas Navickas", "Mantas Navickas", "Lukas Navickas", "Rokas Jankauskas", "Lukas Jankauskas", "Paulius Kazlauskas", "Domantas Petrauskas", "Rokas Petrauskas", "Martynas Kazlauskas", "Edgaras Kazlauskas", "Lukas Stankevičius", "Paulius Stankevičius", "Rokas Stankevičius",
  // Latvian
  "Jānis Bērziņš", "Artūrs Bērziņš", "Jānis Kalniņš", "Jānis Ozoliņš", "Mārtiņš Bērziņš", "Edgars Jansons", "Jānis Liepiņš", "Roberts Bērziņš", "Jānis Krūmiņš", "Artūrs Ozoliņš", "Jānis Balodis", "Jānis Jansons", "Jānis Zariņš", "Edgars Bērziņš", "Rihards Bērziņš", "Toms Bērziņš", "Artūrs Kalniņš", "Mārtiņš Kalniņš", "Mārtiņš Ozoliņš", "Roberts Ozoliņš", "Edgars Kalniņš", "Artūrs Krūmiņš", "Mārtiņš Krūmiņš", "Edgars Ozoliņš", "Artūrs Zariņš",
  // Israeli
  "Yonatan Cohen", "Guy Levi", "Omer Peretz", "Tomer Levi", "Amit Cohen", "Idan Cohen", "Noam Cohen", "Itay Cohen", "Omer Cohen", "Tomer Cohen", "Guy Cohen", "Yonatan Levi", "Amit Levi", "Idan Levi", "Omer Levi", "Noam Levi", "Itay Levi", "Amit Friedman", "Guy Mizrahi", "Itay Shapira", "Noam Shapira", "Omer Mizrahi", "Tomer Shapira", "Amit Biton", "Guy Peretz", "Idan Peretz", "Tomer Peretz",
  // Senegalese
  "Mamadou Ndiaye", "Ibrahima Fall", "Pape Sow", "Cheikh Diallo", "Moussa Sow", "Pape Gueye", "Mamadou Diallo", "Abdoulaye Diallo", "Ibrahima Diallo", "Pape Diop", "Cheikh Sarr", "Moussa Diallo", "Mamadou Diop", "Mamadou Sarr", "Cheikh Ndiaye", "Pape Ndiaye", "Moussa Ndiaye", "Ibrahima Ndiaye", "Ousmane Diop", "Ousmane Ndiaye", "Abdoulaye Ndiaye", "Mamadou Sow", "Mamadou Fall", "Ibrahima Mbaye", "Pape Sarr", "Ousmane Sow", "Ousmane Diallo", "Moussa Diop", "Cheikh Diop", "Pape Diallo", "Ibrahima Sarr", "Mamadou Gueye",
  // Nigerian
  "Emeka Okafor", "Emeka Eze", "Kelechi Nwosu", "Chinedu Okafor", "Kelechi Okafor", "Obinna Okafor", "Ifeanyi Okafor", "Tunde Adebayo", "Segun Adebayo", "Tunde Adeyemi", "Segun Adeyemi", "Babajide Adeyemi", "Babajide Balogun", "Tunde Balogun", "Segun Balogun", "Emeka Okonkwo", "Chinedu Okonkwo", "Ifeanyi Okonkwo", "Obinna Okonkwo", "Emeka Nwosu", "Chinedu Nwosu", "Obinna Nwosu", "Ifeanyi Eze", "Chinedu Eze", "Obinna Eze", "Kelechi Eze", "Emeka Adeyemi", "Tunde Olawale", "Segun Olawale",
  // Found while reviewing the generated league
  "Pablo Serrano", "Dušan Jovanović", "Milan Petrović", "Ognjen Petrović", "Marko Lazić", "Kostas Nikolaidis", "Abdoulaye Diop", "Julien Dubois", "Raúl Romero", "Marcus Whitfield", "Can Aydın", "Kerem Aydın", "Josip Horvat",
  // American
  "Jalen Coleman", "Marcus Coleman", "Andre Coleman", "Devon Coleman", "Marcus Holloway", "Trevor Coleman", "Malik Coleman", "Darius Coleman", "Tyrell Coleman",
]);

// Height range in cm by position, and a one-line scouting note per tendency.
export const HEIGHT = { PG: [182, 193], SG: [189, 198], SF: [197, 205], PF: [202, 210], C: [207, 217] };
export const BLURB = {
  risky_passer: "Sees passes nobody else does, and throws a few he should not.",
  off_ball: "Never stops moving without the ball; loses his man on every screen.",
  clutch: "Quiet for three quarters, then wants every shot in the last two minutes.",
  drives: "Puts his head down and gets to the rim; the jumper is still a work in progress.",
  corner_threes: "Lives in the corners and punishes any late close-out.",
  aggressive_defender: "Picks up full court and plays through every whistle.",
  post_up: "Old-school footwork on the block; needs the ball early in the clock.",
  rebounder: "Reads the miss before it leaves the hand; second chances are his game.",
  poor_ft: "A force around the basket who would rather not be sent to the line.",
};
export const NICKNAMES = [
  "The Surgeon", "Night Shift", "The Lighthouse", "The Locksmith", "Tin Roof", "The Ferryman", "Long Division", "The Notary",
  "Second Wind", "The Cartographer", "Copper Wire", "The Tollbooth", "Late Train", "The Lamplighter", "The Clockmaker", "Last Tram",
];

// The league and its sixteen clubs. Cities and regions are invented or generic.
export const LEAGUE = {
  name: "Meridian Continental League",
  short: "MCL",
  logoText: "MCL",
  founded: 1994,
  tagline: "Sixteen clubs, one crown.",
};

export const CLUBS = {
  gulls: { name: "Marevo Port BC", nation: "Croatian", city: "Marevo", arena: "Lučka Dvorana", rival: "tides", history: "Founded by dock workers in 1961; four cup finals, all of them lost at the buzzer." },
  volts: { name: "Lumena Volt BC", nation: "Greek", city: "Lumena", arena: "Ilektra Arena", rival: "rockets", history: "A power-company team turned pro in 1988; famous for games that end 110-108." },
  rafters: { name: "KK Drinava", nation: "Serbian", city: "Drinava", arena: "Hala Splavara", rival: "rams", history: "River-town club since 1953; the old hall still has wooden stands on one side." },
  gators: { name: "Marais Noir BC", nation: "French", city: "Marais-Noir", arena: "Salle des Roseaux", rival: "forge", history: "Promoted in 2009 and never relegated; nobody enjoys the trip to the marsh." },
  hawks: { name: "Altınyaka Hawks", nation: "Turkish", city: "Altınyaka", arena: "Kanat Spor Salonu", rival: "wolves", history: "University club founded in 1975; the youth academy feeds half the league." },
  wolves: { name: "Nordtor Wolves", nation: "German", city: "Nordtor", arena: "Torhalle", rival: "hawks", history: "Formed in 1999 from two merged city clubs; they have pressed full court ever since." },
  owls: { name: "Mylos Owls", nation: "Greek", city: "Mylos", arena: "Palaio Kleisto", rival: "polar", history: "Champions in 1997 and 2004; the average age of the roster is a running joke." },
  forge: { name: "Valferro Forge", nation: "Italian", city: "Valferro", arena: "PalaFucina", rival: "gators", history: "Steel-town club since 1947; they once won a final 52-49 and celebrated the score." },
  tides: { name: "Bahía Luna CB", nation: "Spanish", city: "Bahía Luna", arena: "Pabellón de la Marea", rival: "gulls", history: "Founded in 1982 by a retired coach who banned dribbling in practice." },
  rams: { name: "Kamenvrh Rams", nation: "Slovenian", city: "Kamenvrh", arena: "Dvorana Pod Skalo", rival: "rafters", history: "Mountain club since 1968; every centre they sign is taller than the last." },
  swans: { name: "BK Sudrabezers", nation: "Latvian", city: "Sudrabezers", arena: "Ezera Halle", rival: "kings", history: "Lake-district club founded in 1991; five positions, one size." },
  polar: { name: "Eiskamm Baskets", nation: "German", city: "Eiskamm", arena: "Kammhalle", rival: "owls", history: "Promoted in 2012; they have never scored 90 and never lost by 20." },
  solar: { name: "Negev Shemesh BC", nation: "Israeli", city: "Negev region", arena: "Heichal HaShemesh", rival: "dynasty", history: "Built in 2006 around one scorer, and rebuilt around the next one ever since." },
  rockets: { name: "Costarossa Rockets", nation: "Italian", city: "Costarossa", arena: "PalaRosso", rival: "volts", history: "Coastal club since 1979; four scoring champions and one assist leader." },
  kings: { name: "Reyes del Sur CB", nation: "Spanish", city: "southern plains", arena: "Pabellón Real", rival: "swans", history: "Founded in 1970; opponents have shot under 45% in their building for a decade." },
  dynasty: { name: "Krunograd Dynasty", nation: "Serbian", city: "Krunograd", arena: "Krunska Arena", rival: "solar", history: "Eleven titles since 1994, six of the last eight. Everyone else plays for second." },
};
