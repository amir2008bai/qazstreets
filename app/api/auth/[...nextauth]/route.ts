// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role ?? 'citizen';
        (session.user as any).id = token.sub;
        (session.user as any).akimatCity = token.akimatCity ?? null;
      }
      return session;
    },
    async jwt({ token, trigger, session }) {
      if (trigger === 'update' && session?.role) {
        token.role = session.role;
        if (session.akimatCity !== undefined) token.akimatCity = session.akimatCity;
      }
      if (!token.role) {
        token.role = 'citizen';
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
