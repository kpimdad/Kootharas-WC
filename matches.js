// World Cup 2026 Full Fixture List
// Tournament: 11 June – 19 July 2026
// Venues across USA, Canada, Mexico
// All kickoff times in UTC
// Source: Al Jazeera / FIFA official schedule

const MATCHES = [

  // ═══════════════════════════════════════════════════════
  // GROUP STAGE — 72 matches across 12 groups (A–L)
  // ═══════════════════════════════════════════════════════

  // ── GROUP A: Mexico, South Korea, Czechia, South Africa ──

  // MD1
  {
    matchId: "m001", matchDay: "Group Stage MD1", stage: "Group", group: "A",
    teamA: "Mexico", teamB: "South Africa", flagA: "🇲🇽", flagB: "🇿🇦",
    kickoffUTC: "2026-06-11T19:00:00Z", venue: "Estadio Azteca, Mexico City",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m002", matchDay: "Group Stage MD1", stage: "Group", group: "A",
    teamA: "South Korea", teamB: "Czechia", flagA: "🇰🇷", flagB: "🇨🇿",
    kickoffUTC: "2026-06-12T02:00:00Z", venue: "Estadio Akron, Guadalajara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m003", matchDay: "Group Stage MD2", stage: "Group", group: "A",
    teamA: "Czechia", teamB: "South Africa", flagA: "🇨🇿", flagB: "🇿🇦",
    kickoffUTC: "2026-06-18T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m004", matchDay: "Group Stage MD2", stage: "Group", group: "A",
    teamA: "Mexico", teamB: "South Korea", flagA: "🇲🇽", flagB: "🇰🇷",
    kickoffUTC: "2026-06-19T01:00:00Z", venue: "Estadio Akron, Guadalajara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m005", matchDay: "Group Stage MD3", stage: "Group", group: "A",
    teamA: "Czechia", teamB: "Mexico", flagA: "🇨🇿", flagB: "🇲🇽",
    kickoffUTC: "2026-06-25T01:00:00Z", venue: "Estadio Azteca, Mexico City",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m006", matchDay: "Group Stage MD3", stage: "Group", group: "A",
    teamA: "South Africa", teamB: "South Korea", flagA: "🇿🇦", flagB: "🇰🇷",
    kickoffUTC: "2026-06-25T01:00:00Z", venue: "Estadio BBVA, Monterrey",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP B: Canada, Bosnia & Herzegovina, Qatar, Switzerland ──

  // MD1
  {
    matchId: "m007", matchDay: "Group Stage MD1", stage: "Group", group: "B",
    teamA: "Canada", teamB: "Bosnia & Herzegovina", flagA: "🇨🇦", flagB: "🇧🇦",
    kickoffUTC: "2026-06-12T19:00:00Z", venue: "BMO Field, Toronto",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m008", matchDay: "Group Stage MD1", stage: "Group", group: "B",
    teamA: "Qatar", teamB: "Switzerland", flagA: "🇶🇦", flagB: "🇨🇭",
    kickoffUTC: "2026-06-13T19:00:00Z", venue: "Levi's Stadium, Santa Clara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m009", matchDay: "Group Stage MD2", stage: "Group", group: "B",
    teamA: "Switzerland", teamB: "Bosnia & Herzegovina", flagA: "🇨🇭", flagB: "🇧🇦",
    kickoffUTC: "2026-06-18T19:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m010", matchDay: "Group Stage MD2", stage: "Group", group: "B",
    teamA: "Canada", teamB: "Qatar", flagA: "🇨🇦", flagB: "🇶🇦",
    kickoffUTC: "2026-06-18T22:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m011", matchDay: "Group Stage MD3", stage: "Group", group: "B",
    teamA: "Switzerland", teamB: "Canada", flagA: "🇨🇭", flagB: "🇨🇦",
    kickoffUTC: "2026-06-24T19:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m012", matchDay: "Group Stage MD3", stage: "Group", group: "B",
    teamA: "Bosnia & Herzegovina", teamB: "Qatar", flagA: "🇧🇦", flagB: "🇶🇦",
    kickoffUTC: "2026-06-24T19:00:00Z", venue: "Lumen Field, Seattle",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP C: Brazil, Morocco, Haiti, Scotland ──

  // MD1
  {
    matchId: "m013", matchDay: "Group Stage MD1", stage: "Group", group: "C",
    teamA: "Brazil", teamB: "Morocco", flagA: "🇧🇷", flagB: "🇲🇦",
    kickoffUTC: "2026-06-13T22:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m014", matchDay: "Group Stage MD1", stage: "Group", group: "C",
    teamA: "Haiti", teamB: "Scotland", flagA: "🇭🇹", flagB: "🏴",
    kickoffUTC: "2026-06-14T01:00:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m015", matchDay: "Group Stage MD2", stage: "Group", group: "C",
    teamA: "Scotland", teamB: "Morocco", flagA: "🏴", flagB: "🇲🇦",
    kickoffUTC: "2026-06-19T22:00:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m016", matchDay: "Group Stage MD2", stage: "Group", group: "C",
    teamA: "Brazil", teamB: "Haiti", flagA: "🇧🇷", flagB: "🇭🇹",
    kickoffUTC: "2026-06-20T00:30:00Z", venue: "Lincoln Financial Field, Philadelphia",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m017", matchDay: "Group Stage MD3", stage: "Group", group: "C",
    teamA: "Scotland", teamB: "Brazil", flagA: "🏴", flagB: "🇧🇷",
    kickoffUTC: "2026-06-24T22:00:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m018", matchDay: "Group Stage MD3", stage: "Group", group: "C",
    teamA: "Morocco", teamB: "Haiti", flagA: "🇲🇦", flagB: "🇭🇹",
    kickoffUTC: "2026-06-24T22:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP D: USA, Paraguay, Australia, Türkiye ──

  // MD1
  {
    matchId: "m019", matchDay: "Group Stage MD1", stage: "Group", group: "D",
    teamA: "USA", teamB: "Paraguay", flagA: "🇺🇸", flagB: "🇵🇾",
    kickoffUTC: "2026-06-13T01:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m020", matchDay: "Group Stage MD1", stage: "Group", group: "D",
    teamA: "Australia", teamB: "Türkiye", flagA: "🇦🇺", flagB: "🇹🇷",
    kickoffUTC: "2026-06-14T04:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m021", matchDay: "Group Stage MD2", stage: "Group", group: "D",
    teamA: "USA", teamB: "Australia", flagA: "🇺🇸", flagB: "🇦🇺",
    kickoffUTC: "2026-06-19T19:00:00Z", venue: "Lumen Field, Seattle",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m022", matchDay: "Group Stage MD2", stage: "Group", group: "D",
    teamA: "Türkiye", teamB: "Paraguay", flagA: "🇹🇷", flagB: "🇵🇾",
    kickoffUTC: "2026-06-20T03:00:00Z", venue: "Levi's Stadium, Santa Clara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m023", matchDay: "Group Stage MD3", stage: "Group", group: "D",
    teamA: "Türkiye", teamB: "USA", flagA: "🇹🇷", flagB: "🇺🇸",
    kickoffUTC: "2026-06-26T02:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m024", matchDay: "Group Stage MD3", stage: "Group", group: "D",
    teamA: "Paraguay", teamB: "Australia", flagA: "🇵🇾", flagB: "🇦🇺",
    kickoffUTC: "2026-06-26T02:00:00Z", venue: "Levi's Stadium, Santa Clara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP E: Germany, Curaçao, Ivory Coast, Ecuador ──

  // MD1
  {
    matchId: "m025", matchDay: "Group Stage MD1", stage: "Group", group: "E",
    teamA: "Germany", teamB: "Curaçao", flagA: "🇩🇪", flagB: "🇨🇼",
    kickoffUTC: "2026-06-14T17:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m026", matchDay: "Group Stage MD1", stage: "Group", group: "E",
    teamA: "Ivory Coast", teamB: "Ecuador", flagA: "🇨🇮", flagB: "🇪🇨",
    kickoffUTC: "2026-06-14T23:00:00Z", venue: "Lincoln Financial Field, Philadelphia",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m027", matchDay: "Group Stage MD2", stage: "Group", group: "E",
    teamA: "Germany", teamB: "Ivory Coast", flagA: "🇩🇪", flagB: "🇨🇮",
    kickoffUTC: "2026-06-20T20:00:00Z", venue: "BMO Field, Toronto",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m028", matchDay: "Group Stage MD2", stage: "Group", group: "E",
    teamA: "Ecuador", teamB: "Curaçao", flagA: "🇪🇨", flagB: "🇨🇼",
    kickoffUTC: "2026-06-21T03:00:00Z", venue: "Arrowhead Stadium, Kansas City",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m029", matchDay: "Group Stage MD3", stage: "Group", group: "E",
    teamA: "Ecuador", teamB: "Germany", flagA: "🇪🇨", flagB: "🇩🇪",
    kickoffUTC: "2026-06-25T20:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m030", matchDay: "Group Stage MD3", stage: "Group", group: "E",
    teamA: "Curaçao", teamB: "Ivory Coast", flagA: "🇨🇼", flagB: "🇨🇮",
    kickoffUTC: "2026-06-25T20:00:00Z", venue: "Lincoln Financial Field, Philadelphia",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP F: Netherlands, Japan, Sweden, Tunisia ──

  // MD1
  {
    matchId: "m031", matchDay: "Group Stage MD1", stage: "Group", group: "F",
    teamA: "Netherlands", teamB: "Japan", flagA: "🇳🇱", flagB: "🇯🇵",
    kickoffUTC: "2026-06-14T20:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m032", matchDay: "Group Stage MD1", stage: "Group", group: "F",
    teamA: "Sweden", teamB: "Tunisia", flagA: "🇸🇪", flagB: "🇹🇳",
    kickoffUTC: "2026-06-15T02:00:00Z", venue: "Estadio BBVA, Monterrey",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m033", matchDay: "Group Stage MD2", stage: "Group", group: "F",
    teamA: "Netherlands", teamB: "Sweden", flagA: "🇳🇱", flagB: "🇸🇪",
    kickoffUTC: "2026-06-20T17:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m034", matchDay: "Group Stage MD2", stage: "Group", group: "F",
    teamA: "Tunisia", teamB: "Japan", flagA: "🇹🇳", flagB: "🇯🇵",
    kickoffUTC: "2026-06-21T04:00:00Z", venue: "Estadio BBVA, Monterrey",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m035", matchDay: "Group Stage MD3", stage: "Group", group: "F",
    teamA: "Japan", teamB: "Sweden", flagA: "🇯🇵", flagB: "🇸🇪",
    kickoffUTC: "2026-06-25T23:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m036", matchDay: "Group Stage MD3", stage: "Group", group: "F",
    teamA: "Tunisia", teamB: "Netherlands", flagA: "🇹🇳", flagB: "🇳🇱",
    kickoffUTC: "2026-06-25T23:00:00Z", venue: "Arrowhead Stadium, Kansas City",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP G: Belgium, Egypt, Iran, New Zealand ──

  // MD1
  {
    matchId: "m037", matchDay: "Group Stage MD1", stage: "Group", group: "G",
    teamA: "Belgium", teamB: "Egypt", flagA: "🇧🇪", flagB: "🇪🇬",
    kickoffUTC: "2026-06-15T19:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m038", matchDay: "Group Stage MD1", stage: "Group", group: "G",
    teamA: "Iran", teamB: "New Zealand", flagA: "🇮🇷", flagB: "🇳🇿",
    kickoffUTC: "2026-06-16T01:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m039", matchDay: "Group Stage MD2", stage: "Group", group: "G",
    teamA: "Belgium", teamB: "Iran", flagA: "🇧🇪", flagB: "🇮🇷",
    kickoffUTC: "2026-06-21T19:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m040", matchDay: "Group Stage MD2", stage: "Group", group: "G",
    teamA: "New Zealand", teamB: "Egypt", flagA: "🇳🇿", flagB: "🇪🇬",
    kickoffUTC: "2026-06-22T01:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m041", matchDay: "Group Stage MD3", stage: "Group", group: "G",
    teamA: "Egypt", teamB: "Iran", flagA: "🇪🇬", flagB: "🇮🇷",
    kickoffUTC: "2026-06-27T03:00:00Z", venue: "Lumen Field, Seattle",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m042", matchDay: "Group Stage MD3", stage: "Group", group: "G",
    teamA: "New Zealand", teamB: "Belgium", flagA: "🇳🇿", flagB: "🇧🇪",
    kickoffUTC: "2026-06-27T03:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP H: Spain, Cape Verde, Saudi Arabia, Uruguay ──

  // MD1
  {
    matchId: "m043", matchDay: "Group Stage MD1", stage: "Group", group: "H",
    teamA: "Spain", teamB: "Cape Verde", flagA: "🇪🇸", flagB: "🇨🇻",
    kickoffUTC: "2026-06-15T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m044", matchDay: "Group Stage MD1", stage: "Group", group: "H",
    teamA: "Saudi Arabia", teamB: "Uruguay", flagA: "🇸🇦", flagB: "🇺🇾",
    kickoffUTC: "2026-06-15T22:00:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m045", matchDay: "Group Stage MD2", stage: "Group", group: "H",
    teamA: "Spain", teamB: "Saudi Arabia", flagA: "🇪🇸", flagB: "🇸🇦",
    kickoffUTC: "2026-06-21T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m046", matchDay: "Group Stage MD2", stage: "Group", group: "H",
    teamA: "Uruguay", teamB: "Cape Verde", flagA: "🇺🇾", flagB: "🇨🇻",
    kickoffUTC: "2026-06-21T22:00:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m047", matchDay: "Group Stage MD3", stage: "Group", group: "H",
    teamA: "Cape Verde", teamB: "Saudi Arabia", flagA: "🇨🇻", flagB: "🇸🇦",
    kickoffUTC: "2026-06-27T00:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m048", matchDay: "Group Stage MD3", stage: "Group", group: "H",
    teamA: "Uruguay", teamB: "Spain", flagA: "🇺🇾", flagB: "🇪🇸",
    kickoffUTC: "2026-06-27T00:00:00Z", venue: "Estadio Akron, Guadalajara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP I: France, Senegal, Iraq, Norway ──

  // MD1
  {
    matchId: "m049", matchDay: "Group Stage MD1", stage: "Group", group: "I",
    teamA: "France", teamB: "Senegal", flagA: "🇫🇷", flagB: "🇸🇳",
    kickoffUTC: "2026-06-16T19:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m050", matchDay: "Group Stage MD1", stage: "Group", group: "I",
    teamA: "Iraq", teamB: "Norway", flagA: "🇮🇶", flagB: "🇳🇴",
    kickoffUTC: "2026-06-16T22:00:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m051", matchDay: "Group Stage MD2", stage: "Group", group: "I",
    teamA: "France", teamB: "Iraq", flagA: "🇫🇷", flagB: "🇮🇶",
    kickoffUTC: "2026-06-22T21:00:00Z", venue: "Lincoln Financial Field, Philadelphia",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m052", matchDay: "Group Stage MD2", stage: "Group", group: "I",
    teamA: "Norway", teamB: "Senegal", flagA: "🇳🇴", flagB: "🇸🇳",
    kickoffUTC: "2026-06-23T00:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m053", matchDay: "Group Stage MD3", stage: "Group", group: "I",
    teamA: "Norway", teamB: "France", flagA: "🇳🇴", flagB: "🇫🇷",
    kickoffUTC: "2026-06-26T19:00:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m054", matchDay: "Group Stage MD3", stage: "Group", group: "I",
    teamA: "Senegal", teamB: "Iraq", flagA: "🇸🇳", flagB: "🇮🇶",
    kickoffUTC: "2026-06-26T19:00:00Z", venue: "BMO Field, Toronto",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP J: Argentina, Algeria, Austria, Jordan ──

  // MD1
  {
    matchId: "m055", matchDay: "Group Stage MD1", stage: "Group", group: "J",
    teamA: "Argentina", teamB: "Algeria", flagA: "🇦🇷", flagB: "🇩🇿",
    kickoffUTC: "2026-06-17T01:00:00Z", venue: "Arrowhead Stadium, Kansas City",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m056", matchDay: "Group Stage MD1", stage: "Group", group: "J",
    teamA: "Austria", teamB: "Jordan", flagA: "🇦🇹", flagB: "🇯🇴",
    kickoffUTC: "2026-06-17T04:00:00Z", venue: "Levi's Stadium, Santa Clara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m057", matchDay: "Group Stage MD2", stage: "Group", group: "J",
    teamA: "Argentina", teamB: "Austria", flagA: "🇦🇷", flagB: "🇦🇹",
    kickoffUTC: "2026-06-22T17:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m058", matchDay: "Group Stage MD2", stage: "Group", group: "J",
    teamA: "Jordan", teamB: "Algeria", flagA: "🇯🇴", flagB: "🇩🇿",
    kickoffUTC: "2026-06-23T03:00:00Z", venue: "Levi's Stadium, Santa Clara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m059", matchDay: "Group Stage MD3", stage: "Group", group: "J",
    teamA: "Algeria", teamB: "Austria", flagA: "🇩🇿", flagB: "🇦🇹",
    kickoffUTC: "2026-06-28T02:00:00Z", venue: "Arrowhead Stadium, Kansas City",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m060", matchDay: "Group Stage MD3", stage: "Group", group: "J",
    teamA: "Jordan", teamB: "Argentina", flagA: "🇯🇴", flagB: "🇦🇷",
    kickoffUTC: "2026-06-28T02:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP K: Portugal, DR Congo, Uzbekistan, Colombia ──

  // MD1
  {
    matchId: "m061", matchDay: "Group Stage MD1", stage: "Group", group: "K",
    teamA: "Portugal", teamB: "DR Congo", flagA: "🇵🇹", flagB: "🇨🇩",
    kickoffUTC: "2026-06-17T17:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m062", matchDay: "Group Stage MD1", stage: "Group", group: "K",
    teamA: "Uzbekistan", teamB: "Colombia", flagA: "🇺🇿", flagB: "🇨🇴",
    kickoffUTC: "2026-06-18T02:00:00Z", venue: "Estadio Azteca, Mexico City",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m063", matchDay: "Group Stage MD2", stage: "Group", group: "K",
    teamA: "Portugal", teamB: "Uzbekistan", flagA: "🇵🇹", flagB: "🇺🇿",
    kickoffUTC: "2026-06-23T17:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m064", matchDay: "Group Stage MD2", stage: "Group", group: "K",
    teamA: "Colombia", teamB: "DR Congo", flagA: "🇨🇴", flagB: "🇨🇩",
    kickoffUTC: "2026-06-24T02:00:00Z", venue: "Estadio Akron, Guadalajara",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m065", matchDay: "Group Stage MD3", stage: "Group", group: "K",
    teamA: "Colombia", teamB: "Portugal", flagA: "🇨🇴", flagB: "🇵🇹",
    kickoffUTC: "2026-06-27T23:30:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m066", matchDay: "Group Stage MD3", stage: "Group", group: "K",
    teamA: "DR Congo", teamB: "Uzbekistan", flagA: "🇨🇩", flagB: "🇺🇿",
    kickoffUTC: "2026-06-27T23:30:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ── GROUP L: England, Croatia, Ghana, Panama ──

  // MD1
  {
    matchId: "m067", matchDay: "Group Stage MD1", stage: "Group", group: "L",
    teamA: "England", teamB: "Croatia", flagA: "🏴", flagB: "🇭🇷",
    kickoffUTC: "2026-06-17T20:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m068", matchDay: "Group Stage MD1", stage: "Group", group: "L",
    teamA: "Ghana", teamB: "Panama", flagA: "🇬🇭", flagB: "🇵🇦",
    kickoffUTC: "2026-06-17T23:00:00Z", venue: "BMO Field, Toronto",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD2
  {
    matchId: "m069", matchDay: "Group Stage MD2", stage: "Group", group: "L",
    teamA: "England", teamB: "Ghana", flagA: "🏴", flagB: "🇬🇭",
    kickoffUTC: "2026-06-23T20:00:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m070", matchDay: "Group Stage MD2", stage: "Group", group: "L",
    teamA: "Panama", teamB: "Croatia", flagA: "🇵🇦", flagB: "🇭🇷",
    kickoffUTC: "2026-06-23T23:00:00Z", venue: "BMO Field, Toronto",
    resultA: null, resultB: null, status: "upcoming"
  },

  // MD3 (simultaneous)
  {
    matchId: "m071", matchDay: "Group Stage MD3", stage: "Group", group: "L",
    teamA: "Panama", teamB: "England", flagA: "🇵🇦", flagB: "🏴",
    kickoffUTC: "2026-06-27T21:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m072", matchDay: "Group Stage MD3", stage: "Group", group: "L",
    teamA: "Croatia", teamB: "Ghana", flagA: "🇭🇷", flagB: "🇬🇭",
    kickoffUTC: "2026-06-27T21:00:00Z", venue: "Lincoln Financial Field, Philadelphia",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ═══════════════════════════════════════════════════════
  // ROUND OF 32 — 16 matches (28 Jun – 3 Jul)
  // Teams TBD based on group results
  // ═══════════════════════════════════════════════════════

  {
    matchId: "m073", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "South Africa", teamB: "Canada", flagA: "🇿🇦", flagB: "🇨🇦",
    kickoffUTC: "2026-06-28T19:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m074", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Brazil", teamB: "Japan", flagA: "🇧🇷", flagB: "🇯🇵",
    kickoffUTC: "2026-06-29T17:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m075", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Germany", teamB: "Paraguay", flagA: "🇩🇪", flagB: "🇵🇾",
    kickoffUTC: "2026-06-29T20:30:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m076", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Netherlands", teamB: "Morocco", flagA: "🇳🇱", flagB: "🇲🇦",
    kickoffUTC: "2026-06-30T01:00:00Z", venue: "Estadio BBVA, Monterrey",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m077", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Ivory Coast", teamB: "Norway", flagA: "🇨🇮", flagB: "🇳🇴",
    kickoffUTC: "2026-06-30T17:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m078", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "France", teamB: "Sweden", flagA: "🇫🇷", flagB: "🇸🇪",
    kickoffUTC: "2026-06-30T21:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m079", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Mexico", teamB: "Ecuador", flagA: "🇲🇽", flagB: "🇪🇨",
    kickoffUTC: "2026-07-01T01:00:00Z", venue: "Estadio Azteca, Mexico City",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m080", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "England", teamB: "DR Congo", flagA: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", flagB: "🇨🇩",
    kickoffUTC: "2026-07-01T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m081", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Belgium", teamB: "Senegal", flagA: "🇧🇪", flagB: "🇸🇳",
    kickoffUTC: "2026-07-01T20:00:00Z", venue: "Lumen Field, Seattle",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m082", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "USA", teamB: "Bosnia & Herzegovina", flagA: "🇺🇸", flagB: "🇧🇦",
    kickoffUTC: "2026-07-02T00:00:00Z", venue: "Levi's Stadium, Santa Clara",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m083", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Spain", teamB: "Austria", flagA: "🇪🇸", flagB: "🇦🇹",
    kickoffUTC: "2026-07-02T19:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m084", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Portugal", teamB: "Croatia", flagA: "🇵🇹", flagB: "🇭🇷",
    kickoffUTC: "2026-07-02T23:00:00Z", venue: "BMO Field, Toronto",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m085", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Switzerland", teamB: "Algeria", flagA: "🇨🇭", flagB: "🇩🇿",
    kickoffUTC: "2026-07-03T03:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m086", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Australia", teamB: "Egypt", flagA: "🇦🇺", flagB: "🇪🇬",
    kickoffUTC: "2026-07-03T18:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m087", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Argentina", teamB: "Cape Verde", flagA: "🇦🇷", flagB: "🇨🇻",
    kickoffUTC: "2026-07-03T22:00:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m088", matchDay: "Round of 32", stage: "R32", group: null,
    teamA: "Colombia", teamB: "Ghana", flagA: "🇨🇴", flagB: "🇬🇭",
    kickoffUTC: "2026-07-04T01:30:00Z", venue: "Arrowhead Stadium, Kansas City",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ═══════════════════════════════════════════════════════
  // ROUND OF 16 — 8 matches (4–7 Jul)
  // ═══════════════════════════════════════════════════════

  {
    matchId: "m089", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Canada", teamB: "Morocco", flagA: "🇨🇦", flagB: "🇲🇦",
    kickoffUTC: "2026-07-04T17:00:00Z", venue: "NRG Stadium, Houston",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m090", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Paraguay", teamB: "France", flagA: "🇵🇾", flagB: "🇫🇷",
    kickoffUTC: "2026-07-04T21:00:00Z", venue: "Lincoln Financial Field, Philadelphia",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m091", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Brazil", teamB: "Norway", flagA: "🇧🇷", flagB: "🇳🇴",
    kickoffUTC: "2026-07-05T20:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m092", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Mexico", teamB: "England", flagA: "🇲🇽", flagB: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    kickoffUTC: "2026-07-06T00:00:00Z", venue: "Estadio Azteca, Mexico City",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m093", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Portugal", teamB: "Spain", flagA: "🇵🇹", flagB: "🇪🇸",
    kickoffUTC: "2026-07-06T19:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m094", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "USA", teamB: "Belgium", flagA: "🇺🇸", flagB: "🇧🇪",
    kickoffUTC: "2026-07-07T00:00:00Z", venue: "Lumen Field, Seattle",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m095", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Argentina", teamB: "Egypt", flagA: "🇦🇷", flagB: "🇪🇬",
    kickoffUTC: "2026-07-07T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m096", matchDay: "Round of 16", stage: "R16", group: null,
    teamA: "Switzerland", teamB: "Colombia", flagA: "🇨🇭", flagB: "🇨🇴",
    kickoffUTC: "2026-07-07T20:00:00Z", venue: "BC Place, Vancouver",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ═══════════════════════════════════════════════════════
  // QUARTER-FINALS — 4 matches (9–11 Jul)
  // ═══════════════════════════════════════════════════════

  {
    matchId: "m097", matchDay: "Quarter-Final", stage: "QF", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-09T20:00:00Z", venue: "Gillette Stadium, Foxborough",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m098", matchDay: "Quarter-Final", stage: "QF", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-10T19:00:00Z", venue: "SoFi Stadium, Los Angeles",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m099", matchDay: "Quarter-Final", stage: "QF", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-11T20:00:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m100", matchDay: "Quarter-Final", stage: "QF", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-12T01:00:00Z", venue: "Arrowhead Stadium, Kansas City",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ═══════════════════════════════════════════════════════
  // SEMI-FINALS — 2 matches (14–15 Jul)
  // ═══════════════════════════════════════════════════════

  {
    matchId: "m101", matchDay: "Semi-Final", stage: "SF", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-14T19:00:00Z", venue: "AT&T Stadium, Arlington",
    resultA: null, resultB: null, status: "upcoming"
  },
  {
    matchId: "m102", matchDay: "Semi-Final", stage: "SF", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-15T19:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ═══════════════════════════════════════════════════════
  // THIRD PLACE PLAY-OFF — 18 Jul
  // ═══════════════════════════════════════════════════════

  {
    matchId: "m103", matchDay: "Third Place", stage: "3RD", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-18T21:00:00Z", venue: "Hard Rock Stadium, Miami",
    resultA: null, resultB: null, status: "upcoming"
  },

  // ═══════════════════════════════════════════════════════
  // FINAL — 19 Jul
  // ═══════════════════════════════════════════════════════

  {
    matchId: "m104", matchDay: "Final", stage: "FINAL", group: null,
    teamA: "TBD", teamB: "TBD", flagA: "🏳", flagB: "🏳",
    kickoffUTC: "2026-07-19T19:00:00Z", venue: "MetLife Stadium, East Rutherford",
    resultA: null, resultB: null, status: "upcoming"
  }

];

