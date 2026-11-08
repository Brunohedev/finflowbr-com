import { Shield, Lock, Mail, Banknote, Database, UserX } from "lucide-react";

const Privacy = () => {
  const sections = [
    {
      num: "1",
      title: "Information We Collect",
      icon: <Database className="w-5 h-5" />,
      body: "We collect information you provide directly to us, such as your name, email, and financial data entered in the app. With your authorization, we also connect to your bank account via Plaid to automatically import transactions.",
    },
    {
      num: "2",
      title: "How We Use Your Information",
      icon: <Shield className="w-5 h-5" />,
      body: "We use your information exclusively to provide the FinFlow service — organizing your monthly budget by categories and generating your daily financial guide. We do not sell, rent, or share your data with third parties for commercial purposes.",
    },
    {
      num: "3",
      title: "Bank Connection via Plaid",
      icon: <Banknote className="w-5 h-5" />,
      body: "The connection to your bank account is made through Plaid Technologies, Inc. FinFlow does not store your banking credentials. By connecting your bank, you are also subject to Plaid's Privacy Policy, available at plaid.com/legal.",
    },
    {
      num: "4",
      title: "Security",
      icon: <Lock className="w-5 h-5" />,
      body: "Your data is securely stored via Supabase and protected by authentication and encryption. Each user can only access their own data.",
    },
    {
      num: "5",
      title: "Your Rights",
      icon: <UserX className="w-5 h-5" />,
      body: "You may delete your account at any time inside the app through Menu → Delete account (Excluir conta), or by submitting the public account deletion form at /delete-account. Account deletion removes your financial information stored in FinFlow, including income, expenses, goals, reserves, investments, and bank transactions, according to our account deletion process. As part of account deletion, FinFlow's access to your bank accounts through Plaid is revoked. Stripe billing records may be retained for billing, accounting, and legal requirements. Emails submitted through the public account deletion request form are retained for up to 30 days after the request is completed and then deleted, unless we are legally required to keep them longer. Plaid may retain certain information according to its own privacy policy. Deleting your FinFlow account does NOT automatically cancel an active Stripe subscription; you must cancel your subscription separately.",
    },
    {
      num: "6",
      title: "Contact",
      icon: <Mail className="w-5 h-5" />,
      body: "finflow.br@gmail.com",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy — FinFlow</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: November 2026</p>
        <p className="text-muted-foreground leading-relaxed mb-10">
          FinFlow ("we") is committed to protecting the privacy of our users. This policy describes how we collect, use, and protect your information.
        </p>

        <div className="space-y-8">
          {sections.map((s) => (
            <div key={s.num} className="flex gap-4">
              <div className="flex-shrink-1 mt-1 text-primary">{s.icon}</div>
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  {s.num}. {s.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Privacy;
