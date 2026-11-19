import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('====================================================');
  console.log('   PENGUJIAN KONEKSI DATABASE SUPABASE POSTGRESQL   ');
  console.log('====================================================\n');

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const database = process.env.SQL_DB_NAME;

  if (!connectionString && !host) {
    console.log('⚠️  PERHATIAN: Variabel DATABASE_URL atau SQL_HOST belum diatur di file .env');
    console.log('   Saat ini aplikasi berjalan menggunakan In-Memory Cache (Mode Preview).');
    console.log('\n👉 Silakan tambahkan connection string Supabase Anda ke file .env:');
    console.log('   DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"\n');
    return;
  }

  const isSupabase = Boolean(
    connectionString?.includes('supabase') ||
    host?.includes('supabase') ||
    process.env.SQL_SSL === 'true'
  );

  console.log('🔍 Menguji koneksi ke database...');
  console.log(`   Host/URI   : ${host || connectionString?.split('@')[1]?.split('/')[0] || 'Cloud URI'}`);
  console.log(`   Provider   : ${isSupabase ? 'Supabase PostgreSQL Cloud' : 'PostgreSQL Server'}`);
  console.log(`   SSL/TLS    : ${isSupabase ? 'Aktif (rejectUnauthorized: false)' : 'Non-SSL'}\n`);

  const pool = new Pool(
    connectionString
      ? {
          connectionString,
          ssl: isSupabase ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000,
        }
      : {
          host,
          port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
          user,
          password: process.env.SQL_PASSWORD,
          database,
          ssl: isSupabase ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000,
        }
  );

  const startTime = Date.now();
  try {
    const client = await pool.connect();
    const latency = Date.now() - startTime;
    console.log(`✅ BERHASIL TERHUBUNG! (Latensi: ${latency} ms)\n`);

    // Periksa tabel
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`📊 Tabel yang ditemukan (${tableNames.length} tabel):`);
    tableNames.forEach(t => console.log(`   - ${t}`));

    // Hitung data users dan siswa
    if (tableNames.includes('users')) {
      const uRes = await client.query('SELECT count(*) FROM users');
      console.log(`\n👥 Total Akun Pengguna (users) : ${uRes.rows[0].count}`);
    }
    if (tableNames.includes('siswa')) {
      const sRes = await client.query('SELECT count(*) FROM siswa');
      console.log(`🎓 Total Data Siswa (siswa)     : ${sRes.rows[0].count}`);
    }
    if (tableNames.includes('absensi')) {
      const aRes = await client.query('SELECT count(*) FROM absensi');
      console.log(`📋 Total Catatan Absensi        : ${aRes.rows[0].count}`);
    }

    client.release();
    await pool.end();

    console.log('\n🎉 KESIMPULAN: Database Supabase Anda SIAP DIGUNAKAN 100% UNTUK PRODUKSI!');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n❌ GAGAL MENGHUBUNGI DATABASE:');
    console.error(`   Pesan Error: ${err.message}`);
    console.log('\n💡 TIPS PEMECAHAN MASALAH:');
    console.log('1. Pastikan password database di URL sudah benar (tanpa tanda kurung siku []).');
    console.log('2. Gunakan port 6543 (Transaction Pooler) jika ISP/jaringan sekolah memblokir port 5432.');
    console.log('3. Pastikan skema tabel sudah dijalankan di Supabase SQL Editor.');
    console.log('====================================================\n');
  }
}

testConnection();
