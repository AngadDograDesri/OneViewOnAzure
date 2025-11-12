const { PrismaClient } = require('./app/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // List of users to create yes
    const users = [
      {
        name: 'Thomas De Swardt',
        email: 'Thomas.de.Swardt@desri.com',
        password: '4P8tyWEGLHba7ouo',
        role: 'user'
      },
      {
        name: 'David Zwillinger',
        email: 'David.Zwillinger@desri.com',
        password: 'QMDuOsLdrxUosZ0t',
        role: 'user'
      },
      {
        name: 'Stephen Jones',
        email: 'Stephen.Jones@desri.com',
        password: 'uEWLy8sj4zBwJJrJ',
        role: 'user'
      },
      {
        name: 'Russell Petrella',
        email: 'Russell.Petrella@desri.com',
        password: 'x63pZbMXtvKnL6EA',
        role: 'user'
      },
      {
        name: 'Carolyn Buttena',
        email: 'Carolyn.Buttena@desri.com',
        password: 'Q5Se5o5i55iExSKG',
        role: 'user'
      }
    ];

    console.log(`🚀 Creating ${users.length} users...\n`);

    for (const userData of users) {
      try {
        console.log(`🔐 Hashing password for ${userData.name}...`);
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        console.log(`👤 Creating user: ${userData.name}...`);
        const user = await prisma.user.create({
          data: {
            email: userData.email.toLowerCase(),
            password: hashedPassword,
            name: userData.name,
            role: userData.role,
            is_active: true,
          },
        });

        console.log('✅ SUCCESS! User created:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 Email:', user.email);
        console.log('👤 Name:', user.name);
        console.log('🔑 Password:', userData.password);
        console.log('👑 Role:', user.role);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`⚠️  User ${userData.email} already exists! Skipping...\n`);
        } else {
          console.error(`❌ ERROR creating ${userData.name}:`, error.message, '\n');
        }
      }
    }

    console.log('\n🎉 User creation process completed!');
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();