import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@/lib/prisma';
import { decryptPassword } from '@/lib/crypto'
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

        // Try find vendor by email
        const vend = await prisma.vendedor.findFirst({
          where: { email: credentials.email.toString().trim() },
        })
        if (!vend) throw new Error('User not found')

        if (!vend.senha_encrypted) throw new Error('User has no password set')

        let plain = ''
        try {
          plain = decryptPassword(vend.senha_encrypted)
        } catch (err) {
          throw new Error('Invalid stored password')
        }

        if (plain !== credentials.password) throw new Error('Invalid password')

        return {
          id: String(vend.id),
          name: vend.nome,
          email: vend.email ?? credentials.email,
        }
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
    // Keep session effectively never-expiring by setting a very large maxAge (10 years)
    maxAge: 10 * 365 * 24 * 60 * 60,
    generateSessionToken: () => randomBytes(32).toString('hex'),
  },
};