/**
 * The downloadable report.pdf. Rendered entirely in the browser with
 * @react-pdf/renderer, so the plan never leaves the person's device.
 *
 * Loaded lazily (see ReportDownloadButton) to keep the PDF engine and fonts
 * out of the main bundle.
 */
import { Document, Font, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { BenefitSummary } from "@/lib/benefits/estimate";
import { formatMoney, LANG_TAG, type Lang, type MessageKey, type T } from "@/lib/i18n";
import type { ReadyPacket } from "@/lib/plan/readyPacket";
import type { Plan } from "@/lib/types";

const CJK_FONTS: Partial<Record<Lang, { family: string; url: string }>> = {
  "zh-Hans": { family: "NotoSansSC", url: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf" },
  "zh-Hant": { family: "NotoSansTC", url: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf" },
};

let registered = false;

export function registerFonts(origin: string) {
  if (registered) return;
  registered = true;
  // Noto Sans covers English, Spanish, and Vietnamese diacritics.
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: `${origin}/fonts/NotoSans-Regular.ttf` },
      { src: `${origin}/fonts/NotoSans-Bold.ttf`, fontWeight: 700 },
    ],
  });
  for (const f of Object.values(CJK_FONTS)) {
    // One weight is enough; the CJK files are large (5–8 MB) and load only when used.
    Font.register({ family: f.family, fonts: [{ src: f.url }, { src: f.url, fontWeight: 700 }] });
  }
  // Chinese has no spaces between words: allow a line break between any two characters.
  Font.registerHyphenationCallback((word) =>
    /[　-〿㐀-鿿＀-￯]/.test(word) ? Array.from(word).flatMap((c) => [c, ""]) : [word],
  );
}

const C = {
  text: "#1c1917",
  muted: "#57534e",
  faint: "#a8a29e",
  line: "#e7e5e4",
  accent: "#b52a16",
  green: "#047857",
  amber: "#b45309",
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, fontSize: 9.5, lineHeight: 1.45, color: C.text },
  brand: { fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.25, marginTop: 6 },
  meta: { fontSize: 8.5, color: C.muted, marginTop: 4 },
  facts: { marginTop: 10, fontSize: 9.5, color: C.muted },
  summary: { marginTop: 8 },
  h2: { fontSize: 12.5, fontWeight: 700, marginTop: 20, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.line },
  total: { fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  cellMain: { flex: 1, paddingRight: 8 },
  cellSide: { width: 150 },
  bold: { fontWeight: 700 },
  small: { fontSize: 8.5, color: C.muted },
  tiny: { fontSize: 7.5, color: C.faint },
  link: { color: C.accent, textDecoration: "none" },
  step: { flexDirection: "row", marginBottom: 6 },
  stepNum: { width: 18, fontWeight: 700, color: C.accent },
  when: { fontSize: 7.5, fontWeight: 700, color: C.accent },
  check: { width: 9, height: 9, borderWidth: 1, borderColor: C.muted, marginRight: 7, marginTop: 2 },
  docRow: { flexDirection: "row", marginBottom: 5 },
  call: { marginBottom: 10, padding: 8, borderWidth: 0.5, borderColor: C.line, borderRadius: 3 },
  quote: { marginTop: 4, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: "#f5c2b8" },
  footer: { position: "absolute", bottom: 26, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.faint },
});

interface Props {
  plan: Plan;
  benefits: BenefitSummary;
  packet: ReadyPacket;
  facts: string[];
  t: T;
  lang: Lang;
}

export function ReportDocument({ plan, benefits, packet, facts, t, lang }: Props) {
  const family = CJK_FONTS[lang]?.family ?? "NotoSans";
  const date = new Date().toLocaleDateString(LANG_TAG[lang], { year: "numeric", month: "long", day: "numeric" });
  const programs = [...plan.ranked, ...plan.related];

  return (
    <Document title={t("report.title")} author="LifeLine" language={LANG_TAG[lang]}>
      <Page size="LETTER" style={[s.page, { fontFamily: family }]}>
        <Text style={s.brand}>LIFELINE</Text>
        <Text style={s.title}>{t("report.title")}</Text>
        <Text style={s.meta}>{t("report.generated", { date })}</Text>
        {facts.length > 0 && <Text style={s.facts}>{facts.join("  ·  ")}</Text>}
        {plan.lang === lang && plan.summary ? <Text style={s.summary}>{plan.summary}</Text> : null}

        {benefits.estimates.length > 0 && (
          <View>
            <Text style={s.h2} minPresenceAhead={80}>{t("benefits.title")}</Text>
            {benefits.monthlyTotal && (
              <Text style={s.total}>
                {benefits.monthlyTotal.low === benefits.monthlyTotal.high
                  ? t("benefits.totalOne", { amount: formatMoney(benefits.monthlyTotal.high, lang) })
                  : t("benefits.total", { low: formatMoney(benefits.monthlyTotal.low, lang), high: formatMoney(benefits.monthlyTotal.high, lang) })}
              </Text>
            )}
            {benefits.estimates.map((e) => (
              <View key={e.id} style={s.row} wrap={false}>
                <View style={s.cellMain}>
                  <Text style={s.bold}>{e.title}</Text>
                  <Text>{e.valueText}</Text>
                  <Text style={s.small}>{e.why[0]}</Text>
                </View>
                <View style={s.cellSide}>
                  <Text style={[s.bold, { color: e.status === "likely" ? C.green : C.amber }]}>
                    {t(e.status === "likely" ? "benefits.likely" : "benefits.possible")}
                  </Text>
                  {e.apply.phone && <Text>{e.apply.phone}</Text>}
                  <Link src={e.apply.url} style={[s.small, s.link]}>
                    {host(e.apply.url)}
                  </Link>
                </View>
              </View>
            ))}
            <Text style={[s.tiny, { marginTop: 4 }]}>{t("benefits.figures", { period: benefits.figuresLabel })}</Text>
          </View>
        )}

        <Text style={s.h2} minPresenceAhead={80}>{t("packet.steps")}</Text>
        {packet.steps.map((step, i) => (
          <View key={i} style={s.step} wrap={false}>
            <Text style={s.stepNum}>{i + 1}.</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.when}>{t(`when.${step.when}` as MessageKey).toUpperCase()}</Text>
              <Text>{step.text}</Text>
              {step.detail && <Text style={s.small}>{step.detail}</Text>}
              {(step.phone || step.link) && (
                <Text style={s.small}>
                  {[step.phone, step.link?.url].filter(Boolean).join("  ·  ")}
                </Text>
              )}
            </View>
          </View>
        ))}

        {packet.documents.length > 0 && (
          <View>
            <Text style={s.h2} minPresenceAhead={80}>{t("packet.docs")}</Text>
            {packet.documents.map((d) => (
              <View key={d.key} style={s.docRow} wrap={false}>
                <View style={s.check} />
                <View style={{ flex: 1 }}>
                  <Text>{d.label}</Text>
                  {d.tip && <Text style={s.small}>{d.tip}</Text>}
                  <Text style={s.tiny}>{t("packet.docs.for", { list: d.forWhat.join(", ") })}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {packet.calls.length > 0 && (
          <View>
            <Text style={s.h2} minPresenceAhead={80}>{t("packet.calls")}</Text>
            {packet.calls.map((c) => (
              <View key={c.resourceId} style={s.call} wrap={false}>
                <Text style={s.bold}>
                  {c.name}
                  {c.phone ? `   ${c.phone}` : ""}
                </Text>
                <Text style={[s.when, { marginTop: 4 }]}>{t("packet.say").toUpperCase()}</Text>
                <Text style={s.quote}>{c.opener}</Text>
                <Text style={[s.when, { marginTop: 4 }]}>{t("packet.ask").toUpperCase()}</Text>
                {c.questions.map((q) => (
                  <Text key={q}>•  {q}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {programs.length > 0 && (
          <View>
            <Text style={s.h2} minPresenceAhead={80}>{t("report.programs")}</Text>
            {programs.map((r, i) => {
              const confirm = r.breakdown.filter((b) => b.status === "unverified").length;
              return (
                <View key={r.resource.id} style={s.row} wrap={false}>
                  <View style={s.cellMain}>
                    <Text style={s.bold}>
                      {i + 1}. {r.resource.name}
                    </Text>
                    <Text style={s.small}>
                      {r.resource.organization} · {t(`category.${r.resource.category}` as MessageKey)}
                    </Text>
                    <Text style={s.tiny}>
                      {r.resource.eligibility_verified && r.resource.last_verified
                        ? t("card.checked", { date: r.resource.last_verified })
                        : t("card.unchecked")}
                      {confirm > 0 ? `  ·  ${confirm === 1 ? t("card.verify.one") : t("card.verify", { n: confirm })}` : ""}
                    </Text>
                  </View>
                  <View style={s.cellSide}>
                    {r.resource.phone && <Text>{r.resource.phone}</Text>}
                    <Link src={r.resource.application_url} style={[s.small, s.link]}>
                      {host(r.resource.application_url)}
                    </Link>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[s.tiny, { marginTop: 18 }]}>{t("plan.disclaimer")}</Text>

        <View style={s.footer} fixed>
          <Text>{t("report.footer")}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** "https://www.pge.com/care" → "pge.com"; the full link stays clickable. */
function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Build the PDF as a Blob. */
export async function renderReport(props: Props): Promise<Blob> {
  registerFonts(window.location.origin);
  return pdf(<ReportDocument {...props} />).toBlob();
}
