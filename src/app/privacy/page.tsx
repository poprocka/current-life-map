import Link from "next/link";
import { GA_SIGNALS } from "@/lib/analytics";

// Privacy & Data Use Notice — text supplied by Jana (October 2026), verbatim.
// The document's implementation note is intentionally not shown to respondents.
// Section 8 (site analytics) added 20 Oct when the analytics banner was replaced by agreement on Begin.
// Sections 7 and 9: Jana's wording, 20 Oct. Section 4 and the provider list updated 21 Oct: 1:1 coaching applications
// replace the paid Life Map Deep Dive; Stripe is no longer used.
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Anonymous by default",
    body: [
      "Your Current Life Map is anonymous by default. You do not need to provide your name or email address to complete the Self-Interview or view your results. Your responses, including optional reflections, may be stored under a technical record that does not require your name or email. This record supports the generation of your Current Life Map and the internal uses described below.",
      "Please avoid entering identifying details in open-response fields. If you voluntarily include identifying information, it may be stored as part of your response. Anonymous by default does not mean that technical information or information you choose to provide can never identify you.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Depending on how you use the experience, information may include: your Self-Interview answers and optional reflections; the Current Life Map and its interpretations; technical information necessary to operate and secure the service; an email address if you request delivery; your name, email address and optional message if you apply for 1:1 coaching; and scheduling information if you book an introductory conversation. We do not require contact details to complete the Self-Interview.",
    ],
  },
  {
    title: "3. Optional PDF delivery",
    body: [
      "If you choose to receive your Current Life Map by email, we use the email address you provide to deliver the requested report and communicate about that request. The email address and related delivery record may be retained for appropriate service and recordkeeping purposes. Requesting email delivery is optional and is not required to view your results.",
    ],
  },
  {
    title: "4. 1:1 coaching applications and introductory conversations",
    body: [
      "If you apply for 1:1 coaching, we collect your name, your email address and, if you choose to share one, your message. We use this information to review your coaching inquiry, communicate with you about it, and arrange a complimentary introductory conversation. Applying does not add you to a mailing list.",
      "When you apply from your Current Life Map or from your PDF email, your application is connected to your Map, answers, and optional reflections, so Jana can understand your inquiry and prepare for your conversation. If you schedule a conversation, the details you enter in our scheduling tool (Calendly) are connected in the same way. Once associated with an identified client, the Map may form part of that client's service record. Research and methodology analysis should use de-identified information rather than the client's identifying details.",
    ],
  },
  {
    title: "5. How information is used",
    body: [
      "We use information to operate the Self-Interview, calculate and display the Current Life Map, provide requested reports and services, respond to inquiries, maintain security, and improve the assessment and Life Architecture methodology. De-identified assessment responses may be analyzed to refine questions, interpretation logic, assessment versions, and understanding of recurring whole-life patterns. We do not intend to publish responses in a way that identifies an individual. Providing an email for report delivery does not, by itself, enroll you in marketing communications.",
    ],
  },
  {
    title: "6. Sensitive topics and your choices",
    body: [
      "Questions may address health, wellbeing, relationships, sexuality, finances, emotions, identity, and other personal matters. Answer only what you feel comfortable sharing. Optional questions may be skipped where the Self-Interview allows. Please do not include information about other identifiable people unless necessary and appropriate.",
    ],
  },
  {
    title: "7. Storage, service providers, and security",
    body: [
      "We use trusted third-party service providers to operate The Self-Interview, securely store information, deliver reports, schedule introductory conversations, and analyze website usage.",
      "These providers include Vercel, Supabase, Resend, Calendly, and Google. They process personal information as necessary to provide their services, subject to applicable privacy and data protection requirements.",
      "Your information may be stored or processed in the United States, including when you access The Self-Interview from another country.",
      "We use reasonable technical and organizational safeguards to protect personal information, including encryption and restricted access. However, no method of electronic storage or transmission is completely secure.",
    ],
  },
  {
    title: "8. Site analytics",
    body: [
      "We use Google Analytics, a service provided by Google, to understand how people find and use this site: for example, which pages are visited, which channel a visit came from (such as Instagram, LinkedIn or a printed card), how far people progress through the Self-Interview, and general device, browser and approximate location information. Google Analytics uses cookies and similar technologies on your device.",
      "Google Analytics runs from your first visit to this site, so we can see both how many people arrive and how many begin the Self-Interview. By using this site and selecting Begin on the welcome page, you agree to this use of Google Analytics. Your answers, optional reflections, results, name and email address are never sent to Google Analytics, and we do not use it for advertising." + (GA_SIGNALS ? " Google signals is enabled, so reports may include Google's broad estimates of visitors' age range, gender and interests." : ""),
      "If your browser sends a Global Privacy Control signal, analytics stays off. You can also block Google Analytics on any site with Google's browser add-on (tools.google.com/dlpage/gaoptout), or by blocking cookies in your browser settings. Google's own handling of this information is described in Google's privacy policy (policies.google.com/privacy).",
    ],
  },
  {
    title: "9. Data Retention",
    body: [
      "We retain personal information only for as long as reasonably necessary to provide our services, improve The Life System™, and fulfill applicable legal and business obligations.",
      "This includes Self-Interview responses, Current Life Maps, optional reflections, email delivery records, coaching applications, bookings, and technical data. Retention depends on the purpose for which the information was collected and any applicable legal requirements.",
      "Third-party service providers may retain certain information in accordance with their own privacy policies.",
      "You may request deletion of your personal information by contacting talk@self-interview.com, subject to applicable legal requirements. We can process deletion requests where the information can reasonably be linked to you. Fully anonymous information may not be identifiable for deletion.",
    ],
  },
  {
    title: "10. Access, correction, and deletion requests",
    body: [
      "If we hold information that identifies you, you may contact us to request access, correction, deletion, or other rights available under applicable law. Some requests may be subject to legal exceptions or identity verification. Contact: talk@self-interview.com. Because anonymous responses are not necessarily linked to your identity, we may be unable to identify a particular anonymous response after submission.",
    ],
  },
  {
    title: "11. Coaching and wellbeing scope",
    body: [
      "The Current Life Map is a reflective coaching and self-awareness tool. It is not medical, psychological, psychiatric, diagnostic, legal, financial, or emergency care and does not replace qualified professional services. Its interpretations are intended to support reflection, not to establish clinical findings or objective judgments about you.",
    ],
  },
  { title: "12. Adults", body: ["The Current Life Map is intended for adults aged 18 and older."] },
  { title: "13. Contact", body: ["For privacy requests, support, or inquiries, email talk@self-interview.com."] },
];

export default function Privacy() {
  return (
    <main className="mx-auto max-w-[680px] px-6 pb-24 pt-14">
      <Link href="/" className="eyebrow hover:text-burgundy">← The Current Life Map</Link>
      <header className="mt-10">
        <h1 className="font-serif text-[40px] font-light leading-tight text-burgundy">Current Life Map</h1>
        <p className="eyebrow mt-3">Privacy &amp; Data Use Notice · October 2026</p>
      </header>
      <p className="mt-10 text-[14.5px] leading-[1.75] text-mahogany/85">
        The Current Life Map is a guided Self-Interview designed to help you see your present life more clearly. This notice
        explains what information may be collected, how it is used, and the choices available to you.
      </p>
      <div className="mt-10 space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-serif text-[22px] font-normal text-burgundy">{s.title}</h2>
            <div className="mt-3 space-y-3 text-[14px] leading-[1.75] text-mahogany/85">
              {s.body.map((p) => <p key={p.slice(0, 40)} className="whitespace-pre-line">{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
