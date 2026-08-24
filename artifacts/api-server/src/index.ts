import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Staff seed data ──────────────────────────────────────────────────────────

const TEACHING_STAFF = [
  // Users 1 & 2 are updated in-place (preserve message history / room membership)
  // Principals
  { email: "sylvester.wongleeyang@gph.edu.com", name: "Mr. Wong Lee Yang Sylvester", role: "teacher" as const, schoolId: "GPH11008084880" },
  // Vice Principals
  { email: "adillah.syedmustafah@gph.edu.com",  name: "Ms. Mustafah Adillah Syed",      role: "teacher" as const, schoolId: "GPH11008084881" },
  { email: "abraham.williamson@gph.edu.com",     name: "Mr. Williamson Abraham Stanley", role: "teacher" as const, schoolId: "GPH11008084882" },
  // HODs
  { email: "nao.flores@gph.edu.com",             name: "Dr. Flores Nao Mio",             role: "teacher" as const, schoolId: "GPH1100884883" },
  { email: "mason.butler@gph.edu.com",           name: "Mr. Butler Mason Elijah",        role: "teacher" as const, schoolId: "GPH1100884891" },
  { email: "li.williams@gph.edu.com",            name: "Dr. Williams Li Na",             role: "teacher" as const, schoolId: "GPH1100884899" },
  { email: "yoo.cruz@gph.edu.com",               name: "Mrs. Cruz Yoo Jin",              role: "teacher" as const, schoolId: "GPH1100884907" },
  { email: "benjamin.king@gph.edu.com",          name: "Dr. King Benjamin Charles",      role: "teacher" as const, schoolId: "GPH1100884915" },
  // Senior Teacher
  { email: "woo.goh@gph.edu.com",               name: "Dr. Goh Woo Jin",                role: "teacher" as const, schoolId: "GPH1100884895" },
  // Teachers (excluding id=1 and id=2 which are updated in-place)
  { email: "yusuf.wilson@gph.edu.com",           name: "Dr. Wilson Yusuf Ibrahim",       role: "teacher" as const, schoolId: "GPH1100884886" },
  { email: "wei.liu@gph.edu.com",                name: "Dr. Liu Wei Liang",              role: "teacher" as const, schoolId: "GPH1100884887" },
  { email: "laura.ramirez@gph.edu.com",          name: "Dr. Ramirez Laura Sophie",       role: "teacher" as const, schoolId: "GPH1100884888" },
  { email: "emilia.jones@gph.edu.com",           name: "Mrs. Jones Emilia Victoria",     role: "teacher" as const, schoolId: "GPH1100884889" },
  { email: "noura.carter@gph.edu.com",           name: "Mrs. Carter Noura Sara",         role: "teacher" as const, schoolId: "GPH1100884890" },
  { email: "sakura.martinez@gph.edu.com",        name: "Mrs. Martinez Sakura Yui",       role: "teacher" as const, schoolId: "GPH1100884892" },
  { email: "ananya.smith@gph.edu.com",           name: "Dr. Smith Ananya Priya",         role: "teacher" as const, schoolId: "GPH1100884893" },
  { email: "laura.ong@gph.edu.com",              name: "Ms. Ong Laura Sophie",           role: "teacher" as const, schoolId: "GPH1100884894" },
  { email: "ji.wang@gph.edu.com",                name: "Mr. Wang Ji Hoon",               role: "teacher" as const, schoolId: "GPH1100884896" },
  { email: "mason.ross@gph.edu.com",             name: "Dr. Ross Mason Elijah",          role: "teacher" as const, schoolId: "GPH1100884897" },
  { email: "ananya.scott@gph.edu.com",           name: "Dr. Scott Ananya Priya",         role: "teacher" as const, schoolId: "GPH1100884898" },
  { email: "elizabeth.koh@gph.edu.com",          name: "Dr. Koh Elizabeth Ella",         role: "teacher" as const, schoolId: "GPH1100884900" },
  { email: "mila.edwards@gph.edu.com",           name: "Dr. Edwards Mila Avery",         role: "teacher" as const, schoolId: "GPH1100884901" },
  { email: "li.ramirez@gph.edu.com",             name: "Mrs. Ramirez Li Na",             role: "teacher" as const, schoolId: "GPH1100884902" },
  { email: "harry.hill@gph.edu.com",             name: "Dr. Hill Harry Jacob",           role: "teacher" as const, schoolId: "GPH1100884903" },
  { email: "layla.patterson@gph.edu.com",        name: "Mrs. Patterson Layla Maryam",    role: "teacher" as const, schoolId: "GPH1100884904" },
  { email: "haeun.james@gph.edu.com",            name: "Mrs. James Haeun Soo",           role: "teacher" as const, schoolId: "GPH1100884905" },
  { email: "aiden.wright@gph.edu.com",           name: "Dr. Wright Aiden Jayden",        role: "teacher" as const, schoolId: "GPH1100884906" },
  { email: "willow.patterson@gph.edu.com",       name: "Mrs. Patterson Willow Evelyn",   role: "teacher" as const, schoolId: "GPH1100884908" },
  { email: "chloe.park@gph.edu.com",             name: "Ms. Park Chloe Lily",            role: "teacher" as const, schoolId: "GPH1100884909" },
  { email: "jean.goh@gph.edu.com",               name: "Mr. Goh Jean Pierre",            role: "teacher" as const, schoolId: "GPH1100884910" },
  { email: "omar.kelly@gph.edu.com",             name: "Dr. Kelly Omar Khalid",          role: "teacher" as const, schoolId: "GPH1100884911" },
  { email: "isla.rodriguez@gph.edu.com",         name: "Dr. Rodriguez Isla Poppy",       role: "teacher" as const, schoolId: "GPH1100884912" },
  { email: "laura.flores@gph.edu.com",           name: "Dr. Flores Laura Sophie",        role: "teacher" as const, schoolId: "GPH1100884913" },
  { email: "jun.moore@gph.edu.com",              name: "Dr. Moore Jun Hao",              role: "teacher" as const, schoolId: "GPH1100884914" },
  { email: "ethan.reed@gph.edu.com",             name: "Mr. Reed Ethan Logan",           role: "teacher" as const, schoolId: "GPH1100884916" },
  { email: "zhi.teo@gph.edu.com",                name: "Mr. Teo Zhi Ming",               role: "teacher" as const, schoolId: "GPH1100884917" },
  { email: "haeun.evans@gph.edu.com",            name: "Dr. Evans Haeun Soo",            role: "teacher" as const, schoolId: "GPH1100884918" },
];

const NON_TEACHING_STAFF = [
  { email: "manon.brown@gph.edu.com",   name: "Ms. Brown Manon Chloe",      role: "admin" as const, schoolId: "GPH1100884919" },
  { email: "joseph.young@gph.edu.com",  name: "Dr. Young Joseph Edward",    role: "admin" as const, schoolId: "GPH1100884920" },
  { email: "woo.jones@gph.edu.com",     name: "Dr. Jones Woo Jin",          role: "admin" as const, schoolId: "GPH1100884921" },
  { email: "louis.barnes@gph.edu.com",  name: "Dr. Barnes Louis Francois",  role: "admin" as const, schoolId: "GPH1100884922" },
  { email: "yoo.bryant@gph.edu.com",    name: "Mrs. Bryant Yoo Jin",        role: "admin" as const, schoolId: "GPH1100884923" },
  { email: "max.ng@gph.edu.com",        name: "Dr. Ng Max Lucas",           role: "admin" as const, schoolId: "GPH1100884924" },
];

// ── Seed function ────────────────────────────────────────────────────────────

async function seedAll() {
  // 1. Update the two legacy teacher accounts in-place (preserves FK refs in messages/room_members)
  await db
    .update(usersTable)
    .set({
      name: "Dr. Brown Christopher Andrew",
      email: "christopher.brown@gph.edu.com",
      schoolId: "GPH1100884884",
    })
    .where(eq(usersTable.id, 1));

  await db
    .update(usersTable)
    .set({
      name: "Dr. Peterson Karim Jamal",
      email: "karim.peterson@gph.edu.com",
      schoolId: "GPH1100884885",
    })
    .where(eq(usersTable.id, 2));

  logger.info("Updated legacy teacher accounts (id=1, id=2) to new staff");

  // 2. Fix message content that embedded old teacher names
  const messageUpdates: Array<{ id: number; content: string }> = [
    { id: 1,  content: "Dr. Brown Christopher Andrew created this room" },
    { id: 3,  content: "Morning, Dr. Brown! Ready!" },
    { id: 6,  content: "Dr. Brown, is Rash coming in today?" },
    { id: 8,  content: "Dr. Brown Christopher Andrew marked Rash Isa as Absent" },
    { id: 13, content: "Dr. Brown Christopher Andrew finalized attendance" },
    { id: 16, content: "Dr. Brown, I might need to leave early today. I have a doctor's appointment at 2pm." },
    { id: 22, content: "Dr. Brown Christopher Andrew approved leave for Hannah Cullum" },
  ];

  for (const { id, content } of messageUpdates) {
    await pool.query("UPDATE messages SET content = $1 WHERE id = $2", [content, id]);
  }
  logger.info("Updated message content to use new teacher names");

  // 3. Seed remaining 43 staff (teaching + non-teaching) idempotently by email
  const allStaff = [...TEACHING_STAFF, ...NON_TEACHING_STAFF];
  let inserted = 0;
  for (const staff of allStaff) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, staff.email));
    if (!existing) {
      await db.insert(usersTable).values({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        schoolId: staff.schoolId,
        status: "offline",
      });
      inserted++;
    }
  }
  logger.info({ inserted }, "Seeded staff users");

  // 4. Seed parent users (idempotent)
  const parents = [
    { name: "Mr. Jordanis", email: "jordanis.parent@heyya.app", role: "parent" as const, childId: 18 },
    { name: "Ms. Poh",      email: "poh.parent@heyya.app",      role: "parent" as const, childId: 14 },
  ];

  for (const parent of parents) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, parent.email));
    if (!existing) {
      await db.insert(usersTable).values({ ...parent, status: "offline" });
      logger.info({ name: parent.name }, "Seeded parent user");
    }
  }
}

seedAll()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to seed");
    process.exit(1);
  });
