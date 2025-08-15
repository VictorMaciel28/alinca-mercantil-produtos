import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import PasswordHash from 'wordpress-hash-node';

// Extend the Session type to include user.id
import type { Session } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

const prisma = new PrismaClient();

export const options: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: {
          label: 'Email:',
          type: 'text',
          placeholder: 'Enter your email',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const users = await prisma.$queryRawUnsafe(
          'SELECT ID, user_login, user_pass, user_email FROM wp_users WHERE user_email = ?',
          credentials.email
        ) as {
          ID: number;
          user_login: string;
          user_pass: string;
          user_email: string;
        }[];

        const user = users[0];
        if (!user) throw new Error('User not found');

       const isValid = await bcrypt.compare(credentials.password, user.user_pass);

        if (!isValid) throw new Error('Invalid password');
        return {
          id: String(user.ID),
          name: user.user_login,
          email: user.user_email,
        };
      }
    }),
  ],
  secret: 'kvwLrfri/MBznUCofIoRH9+NvGu6GqvVdqO3mor1GuA=',

  pages: {
    signIn: '/auth/sign-in',
  },

  callbacks: {
    async signIn({ user }) {
      return true;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.sub = user.id;
      }
      return token;
    },
    redirect({ baseUrl }) {
      // Redireciona para a página de editais abertos após o login
      return `${baseUrl}/magazine/submission-page`;
    }
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
    generateSessionToken: () => randomBytes(32).toString('hex'),
  },
};