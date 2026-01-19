import fs from 'fs';
import axios from "axios";
import extra from "fs-extra";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";

const agents = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); //Establishes what directory were working in
const DATA_OUTPUT_DIR = path.join(__dirname, "../data"); //Establishes that our data ourput will be in our current working directory an>
async function verifyOutputDirectory() {
    try {
        await extra.ensureDir(DATA_OUTPUT_DIR);
        console.log(chalk.green.bold("[OK]"), `Output directory ready: ${DATA_OUTPUT_DIR}`);
    } catch (err) {
        console.error(chalk.red.bold("[ERR]"), `Failed to ensure output directory:`, err);
        throw err;
    }
}

async function createAgents() {
  const stream = fs.createWriteStream(path.join(DATA_OUTPUT_DIR, 'agents.json'));
  stream.write('[');
  
  let buffer = [];
  const BATCH_SIZE = 50000;
  
  for (let i = 1; i <= 920000; i++) {
    const person = {
      name: createName(),
      age: createAge(),
      county: createCounty(),
      job: createJob(),
      hobbies: createHobbies(),
      agentNumber: `${i}`
    };
    
    buffer.push(JSON.stringify(person));
    
    // Write batch when full
    if (buffer.length >= BATCH_SIZE) {
      const chunk = (i === BATCH_SIZE ? '' : ',\n') + buffer.join(',\n');
      if (!stream.write(chunk)) {
        await new Promise(resolve => stream.once('drain', resolve));
      }
      buffer = [];
      
      if (i % 5000 === 0) {
        console.log(chalk.magenta.bold("[BUILD]"), `Wrote ${i} agents...`);
      }
    }
  }
  
  // Write remaining
  if (buffer.length > 0) {
    stream.write(',\n' + buffer.join(',\n'));
  }
  
  stream.write(']');
  stream.end();
  
  return new Promise(resolve => {
    stream.on('finish', () => {
      console.log('✅ Finished writing all agents!');
      resolve();
    });
  });
}

  const agentFirstNames = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer",
    "Michael", "Linda", "William", "Elizabeth", "David", "Barbara",
    "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah",
    "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra",
    "Donald", "Ashley", "Steven", "Kimberly", "Paul", "Emily",
    "Andrew", "Donna", "Joshua", "Michelle", "Kenneth", "Dorothy",
    "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca",
    "Jason", "Laura", "Jeffrey", "Sharon", "Ryan", "Cynthia",
    "Jacob", "Kathleen", "Gary", "Amy", "Nicholas", "Shirley",
    "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
    "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole",
    "Brandon", "Emma", "Benjamin", "Samantha", "Samuel", "Katherine",
    "Gregory", "Christine", "Frank", "Debra", "Alexander", "Rachel",
    "Raymond", "Catherine", "Patrick", "Carolyn", "Jack", "Janet", "Gregory", "Christine", "Frank", "Debra", "Alexander", "Rachel",
    "Raymond", "Catherine", "Patrick", "Carolyn", "Jack", "Janet"
  ];
  const agentLastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
    "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris",
    "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
    "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos",
    "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez",
    "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
    "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long",
    "Ross", "Foster", "Jimenez"
  ];

const agentCounties = [ "Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte", "Citrus", "Clay", "Collier", "Columbia", "DeSoto", "Dixie", "Duval", "Escambia", "Flagler", "Franklin", "Gadsden", "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee", "Hendry", "Hernando", "Highlands", "Hillsborough", "Holmes", "Indian River", "Jackson", "Jefferson", "Lafayette", "Lake", "Lee", "Leon", "Levy", "Liberty", "Madison", "Manatee", "Marion", "Martin", "Miami-Dade", "Monroe", "Nassau", "Okaloosa", "Okeechobee", "Orange", "Osceola", "Palm Beach", "Pasco", "Pinellas", "Polk", "Putnam", "Santa Rosa", "Sarasota", "Seminole", "St. Johns", "St. Lucie", "Sumter", "Suwannee", "Taylor", "Union", "Volusia", "Wakulla", "Walton", "Washington" ];
const agentJobs = [ "Dishwasher", "Janitor", "Cashier", "Fast Food Worker", "Cleaner", "Farm Laborer", "Landscaper", "Parking Attendant", "Hotel Housekeeper", "Warehouse Picker", "Gas Station Attendant", "Street Sweeper", "Laundry Attendant", "Grocery Bagger", "Messenger", "Bellhop", "Security Guard", "Construction Laborer", "Busser", "Dog Walker", "Electrician", "Plumber", "Carpenter", "Chef", "Administrative Assistant", "Truck Driver", "Paralegal", "Dental Hygienist", "Medical Assistant", "Hair Stylist", "Real Estate Agent", "Insurance Agent", "Police Officer", "Firefighter", "Photographer", "Journalist", "Graphic Designer", "Marketing Coordinator", "Sales Representative", "HVAC Technician", "Welder", "Travel Agent", "Personal Trainer", "Librarian Assistant", "Veterinary Technician", "Bank Teller", "Flight Attendant", "Receptionist", "Court Reporter", "Baker", "Bartender", "Nanny", "Mechanic", "Phlebotomist", "Social Worker (associate degree level)", "Chef's Assistant", "Butcher", "Tailor", "Florist", "Data Entry Clerk", "Software Developer", "Data Scientist", "Physician", "Surgeon", "Lawyer", "Civil Engineer", "Architect", "University Professor", "Chemist", "Financial Analyst", "Nurse Practitioner", "Clinical Psychologist", "Actuary", "Biomedical Engineer", "Economist", "Computer Systems Analyst", "Dentist", "Pharmacist", "Airline Pilot", "Statistician", "Management Consultant", "UX Designer", "Veterinarian", "Geologist", "Astronaut", "Urban Planner", "Mathematician", "Epidemiologist", "Research Scientist", "Database Administrator", "Chief Executive Officer (CEO)", "Investment Banker", "Art Director", "Biotechnologist", "Machine Learning Engineer", "Pediatrician", "Foreign Service Officer", "Speech-Language Pathologist", "Quantum Physicist", "Full Stack Developer", "Cyber Security Analyst", "Chief Financial Officer (CFO)", "Neurosurgeon", "Patent Attorney", "Robotics Engineer", "Solar Energy Systems Engineer", "Ethical Hacker", "Cloud Solutions Architect" ];
const agentHobbies = [
  // Florida-specific hobbies
  "Beach activities",
  "Fishing",
  "Boating",
  "Swimming",
  "Snorkeling",
  "Scuba diving",
  "Surfing",
  "Paddleboarding",
  "Kayaking",
  "Golf",
  "Tennis",
  "Hiking",
  "Birdwatching",
  "Photography",
  "Camping",
  "Cycling",
  "Visiting theme parks",
  "Water skiing",
  "Jet skiing",
  "Sailing",
  "Wildlife watching",
  "Gardening",
  "Collecting seashells",
  "Beach volleyball",
  "Pickleball",
  "Running",
  "Yoga",
  "Horseback riding",
  "Nature walks",
  "RV camping",
  
  // General hobbies
  "Reading",
  "Writing",
  "Drawing",
  "Painting",
  "Cooking",
  "Baking",
  "Playing video games",
  "Board games",
  "Card games",
  "Watching movies",
  "Watching TV shows",
  "Listening to music",
  "Playing musical instruments",
  "Singing",
  "Dancing",
  "Knitting",
  "Crocheting",
  "Sewing",
  "Woodworking",
  "Crafting",
  "Collecting (coins, stamps, etc.)",
  "Puzzles",
  "Meditation",
  "Traveling",
  "Learning languages",
  "Volunteering",
  "Blogging",
  "Podcasting",
  "Social media",
  "Shopping",
  "Fitness training",
  "Martial arts",
  "Rock climbing",
  "Skateboarding",
  "Basketball",
  "Soccer",
  "Baseball",
  "Football",
  "Astronomy",
  "Chess",
  "Magic tricks",
  "Stand-up comedy",
  "Theater",
  "Investing",
  "Home improvement",
  "Car restoration",
  "Antique collecting"
];

function createName() {
  const first = agentFirstNames[(Math.random() * agentFirstNames.length) | 0];
  const last = agentLastNames[(Math.random() * agentLastNames.length) | 0];
  return `${first}, ${last}`;
}

function createCounty() {
const county = agentCounties[(Math.random() * agentCounties.length) | 0];
return `${county}`;
}

function createJob() {
const job = agentJobs[(Math.random() * agentJobs.length) | 0];
return `${job}`;
}

function createHobbies() {
const hobby1 = agentHobbies[(Math.random() * agentHobbies.length) | 0];
const hobby2 = agentHobbies[(Math.random() * agentHobbies.length) | 0];
return `[${hobby1},${hobby2}]`;
}

const TWO_PI = 2 * Math.PI;

function createAge() {
  let u = Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
  let age = (35 + 15 * z) | 0; // Bitwise OR is faster than Math.round
  return age > 100 ? 100 : age < 1 ? 1 : age;
}

async function main() {
        console.log(chalk.cyan("=== Lightning Sim Agent Constructor ==="));
        console.log("Started at:", new Date().toLocaleString());
        console.log("Working directory:", process.cwd());
        console.log("Script directory:", __dirname);
        console.log("--------------------------------");
        await verifyOutputDirectory();
        await createAgents();
}

main();
