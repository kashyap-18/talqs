export type Topic = "facts" | "outcome" | "remedy" | "law";

export type CorpusChunk = {
  id: string;
  title: string;
  topic: Topic[];
  text: string;
  sourceLabel: string;
  sourceUrl: string;
  page?: number;
};

export type CaseDoc = {
  id: string;
  title: string;
  shortTitle: string;
  forum: string;
  decisionDate: string;
  level: "District" | "State" | "National" | "Unknown";
  platform: string;
  category: string;
  posture: string;
  disposition: string;
  sourceUrl: string;
  sourceNote: string;
  officialLookupUrl: string;
  summary: string[];
  qa: Record<Topic, string>;
  chunks: CorpusChunk[];
  origin?: "curated" | "session-upload" | "stored-upload";
  rawText?: string;
  pageCount?: number;
};

export const officialSources = [
  {
    label: "Consumer Protection Act, 2019",
    publisher: "India Code",
    url: "https://www.indiacode.nic.in/handle/123456789/15256?sam_handle=123456789%2F1362",
  },
  {
    label: "Consumer Protection rules and E-Commerce Rules, 2020",
    publisher: "Department of Consumer Affairs",
    url: "https://consumeraffairs.gov.in/pages/consumer-protection-acts",
  },
  {
    label: "Official consumer-commission judgment lookup",
    publisher: "e-Jagriti, Department of Consumer Affairs",
    url: "https://e-jagriti.gov.in/advance-case-search",
  },
];

export const statutoryChunks: CorpusChunk[] = [
  {
    id: "CPA-2-7",
    title: "Consumer definition includes online purchases",
    topic: ["law"],
    text:
      "The 2019 Act's consumer definition covers people who buy goods or hire services through electronic means, teleshopping, direct selling, or multi-level marketing, subject to the commercial-purpose exclusions.",
    sourceLabel: "Consumer Protection Act, 2019, Section 2(7)",
    sourceUrl:
      "https://www.indiacode.nic.in/handle/123456789/15256?sam_handle=123456789%2F1362",
  },
  {
    id: "CPA-35",
    title: "Complaint filing route",
    topic: ["law"],
    text:
      "Section 35 sets the statutory route for making a consumer complaint before the District Commission by a consumer, recognised association, government authority, or multiple consumers with the same interest.",
    sourceLabel: "Consumer Protection Act, 2019, Section 35",
    sourceUrl:
      "https://www.indiacode.nic.in/handle/123456789/15256?sam_handle=123456789%2F1362",
  },
  {
    id: "CPA-39",
    title: "Commission findings and remedies",
    topic: ["law", "remedy"],
    text:
      "Section 39 is the remedial provision District Commissions use after finding defect, deficiency, unfair trade practice, or related consumer injury; typical relief can include repair, replacement, refund, compensation, and costs.",
    sourceLabel: "Consumer Protection Act, 2019, Section 39",
    sourceUrl:
      "https://www.indiacode.nic.in/handle/123456789/15256?sam_handle=123456789%2F1362",
  },
  {
    id: "CPA-94",
    title: "E-commerce unfair-trade-practice rulemaking",
    topic: ["law"],
    text:
      "Section 94 empowers measures to prevent unfair trade practices in e-commerce and direct selling, which is why marketplace duties can matter in online-shopping complaints.",
    sourceLabel: "Consumer Protection Act, 2019, Section 94",
    sourceUrl:
      "https://www.indiacode.nic.in/handle/123456789/15256?sam_handle=123456789%2F1362",
  },
  {
    id: "ECR-2020",
    title: "Marketplace seller-information duties",
    topic: ["law"],
    text:
      "The Department of Consumer Affairs lists the Consumer Protection (E-Commerce) Rules, 2020; marketplace cases often turn on whether the platform verified sellers, fulfilment, product descriptions, and grievance handling.",
    sourceLabel: "Consumer Protection (E-Commerce) Rules, 2020",
    sourceUrl: "https://consumeraffairs.gov.in/pages/consumer-protection-acts",
  },
];

const eJagritiLookup = "https://e-jagriti.gov.in/advance-case-search";

export const cases: CaseDoc[] = [
  {
    id: "paras-jain-amazon-2021",
    title: "Paras Jain v. Amazon Seller Services Pvt. Ltd.",
    shortTitle: "Paras Jain v Amazon",
    forum: "National Consumer Disputes Redressal Commission, New Delhi",
    decisionDate: "2021-09-22",
    level: "National",
    platform: "Amazon",
    category: "Mobile return policy",
    posture: "Consumer complaint before NCDRC",
    disposition: "Complaint dismissed as not maintainable for pecuniary jurisdiction; no merits finding.",
    sourceUrl: "https://indiankanoon.org/doc/176347235/",
    sourceNote:
      "Seeded from a public judgment mirror of the NCDRC order; official lookup route retained through e-Jagriti/NCDRC.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The complainant bought a Coolpad Note 3 through Amazon and said heating issues made him seek a refund under advertised easy returns.",
      "Amazon said its mobile-phone policy had already changed to replacement-only for purchases after 7 February 2016 and that the change had been publicised.",
      "The NCDRC focused on maintainability, inflated punitive damages, and pecuniary jurisdiction rather than deciding whether the handset was defective on the merits.",
    ],
    qa: {
      facts:
        "Paras Jain bought a Coolpad Note 3 on Amazon after the platform changed its mobile return policy. He alleged the phone heated up and that the advertised easy-return claim misled buyers, while Amazon said replacement remained available and the policy change had been publicised.",
      outcome:
        "The NCDRC dismissed the complaint as not maintainable for want of pecuniary jurisdiction and expressly avoided deciding the merits.",
      remedy:
        "No refund, compensation, or punitive damages were granted in this proceeding. The Commission allowed the complainant to approach the appropriate forum and excluded the time spent before NCDRC for limitation purposes.",
      law:
        "The order treats punitive damages as discretionary and not part of ordinary compensation for pecuniary jurisdiction, and it rejected using a very large punitive-damages figure to move a low-value purchase into NCDRC jurisdiction.",
    },
    chunks: [
      {
        id: "PJ-F1",
        title: "Purchase and return-policy dispute",
        topic: ["facts"],
        text:
          "The order records a 23 February 2016 Coolpad Note 3 purchase for Rs. 9,119; after alleged heating, the complainant sought refund under easy returns, but Amazon treated mobiles as replacement-only after 7 February 2016.",
        sourceLabel: "NCDRC order, facts section",
        sourceUrl: "https://indiankanoon.org/doc/176347235/",
      },
      {
        id: "PJ-O1",
        title: "Maintainability result",
        topic: ["outcome", "remedy"],
        text:
          "The Commission dismissed the case as not maintainable for pecuniary jurisdiction and clarified that it had not expressed an opinion on the merits.",
        sourceLabel: "NCDRC order, final paragraphs",
        sourceUrl: "https://indiankanoon.org/doc/176347235/",
      },
      {
        id: "PJ-L1",
        title: "Punitive damages and jurisdiction",
        topic: ["law"],
        text:
          "The Commission relied on the principle that punitive damages are exceptional and cannot be used as ordinary compensation to determine pecuniary jurisdiction.",
        sourceLabel: "NCDRC order, jurisdiction analysis",
        sourceUrl: "https://indiankanoon.org/doc/176347235/",
      },
    ],
  },
  {
    id: "jagan-flipkart-2024",
    title: "Jagan Nath Bhandari v. Flipkart Internet Private Limited",
    shortTitle: "Jagan Bhandari v Flipkart",
    forum: "State Consumer Disputes Redressal Commission, U.T. Chandigarh",
    decisionDate: "2024-10-14",
    level: "State",
    platform: "Flipkart",
    category: "Defective mobile refund delay",
    posture: "Appeal for enhancement of District Commission award",
    disposition: "Appeal dismissed; District Commission award upheld.",
    sourceUrl: "https://indiankanoon.org/doc/29033133/",
    sourceNote:
      "Seeded from a public judgment mirror of the State Commission order; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer bought a Redmi Note 7 Pro on EMI through Flipkart, returned it within the return window for defects, and sought a refund.",
      "Flipkart delayed refund until 30 December 2019, after additional EMI deductions caused a small financial loss.",
      "The State Commission declined to enhance the District Commission's award, saying the Rs. 801 loss with interest was adequate on the record.",
    ],
    qa: {
      facts:
        "The consumer ordered a Redmi Note 7 Pro for Rs. 11,999 through Flipkart on EMI, returned it within 10 days because of defects, and alleged that delayed refund caused extra EMI-related loss.",
      outcome:
        "The State Commission dismissed the consumer's enhancement appeal and upheld the District Commission order against Flipkart.",
      remedy:
        "The upheld remedy was Rs. 801 with 10% annual interest from complaint filing until actual payment. No additional compensation or litigation cost enhancement was granted.",
      law:
        "The order applies Section 41 appellate review under the 2019 Act and cautions that consumer fora should compensate proved loss, not enrich consumers with exaggerated awards.",
    },
    chunks: [
      {
        id: "JB-F1",
        title: "Defective phone returned within 10 days",
        topic: ["facts"],
        text:
          "The appellate order records that the Redmi phone was returned within the 10-day return period because the consumer found defects and sought refund.",
        sourceLabel: "State Commission order, paras 2 and 9",
        sourceUrl: "https://indiankanoon.org/doc/29033133/",
      },
      {
        id: "JB-R1",
        title: "Refund delay and financial loss",
        topic: ["facts", "remedy"],
        text:
          "Refund was ultimately made after about two months, and the District Commission awarded Rs. 801 for loan-interest loss with 10% interest.",
        sourceLabel: "State Commission order, paras 8-10",
        sourceUrl: "https://indiankanoon.org/doc/29033133/",
      },
      {
        id: "JB-O1",
        title: "Enhancement rejected",
        topic: ["outcome", "law"],
        text:
          "The State Commission held that no further compensation was payable and dismissed the appeal for enhancement.",
        sourceLabel: "State Commission order, final paragraphs",
        sourceUrl: "https://indiankanoon.org/doc/29033133/",
      },
    ],
  },
  {
    id: "vishnu-amazon-2023",
    title: "Amazon Seller Services Pvt. Ltd. v. Vishnu Ranjidas",
    shortTitle: "Amazon v Vishnu Ranjidas",
    forum: "Kerala State Consumer Disputes Redressal Commission",
    decisionDate: "2023-06-01",
    level: "State",
    platform: "Amazon",
    category: "High-value graphics-card delivery failure",
    posture: "Appeal from Wayanad District Commission",
    disposition: "Appeal dismissed at admission; District Commission relief left undisturbed.",
    sourceUrl: "https://indiankanoon.org/doc/103476297/",
    sourceNote:
      "Seeded from a public judgment mirror of the State Commission order; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "A professional user ordered a high-end graphics card for Rs. 1,99,989 through Amazon and later cancelled when tracking and delivery information became inconsistent.",
      "The record says a proof-of-delivery document showed delivery before the expected delivery period and the signature was disputed.",
      "The District Commission granted major relief ex parte; the State Commission dismissed the appeal because the appellant was not the original opposite party and the ex parte procedure was proper.",
    ],
    qa: {
      facts:
        "The consumer ordered a high-end graphics card for Rs. 1,99,989. The shipment was delayed, tracking changed, the refund request was declined after a disputed proof of delivery, and a courier inquiry allegedly showed the tracking related to another item/address.",
      outcome:
        "The Kerala State Commission dismissed the appeal and left the District Commission order in place.",
      remedy:
        "The District Commission had directed supply of the ordered graphics card or refund of Rs. 1,99,989 with 8% interest, plus Rs. 3,00,000 compensation and Rs. 10,000 costs.",
      law:
        "The appellate decision turned on maintainability and ex parte procedure: the appellant was treated as a stranger to the original complaint, and the District Commission had proceeded after served parties did not contest.",
    },
    chunks: [
      {
        id: "VR-F1",
        title: "High-value order and delayed tracking",
        topic: ["facts"],
        text:
          "The consumer ordered a graphics card for Rs. 1,99,989, received delay notices, cancelled, and sought refund when the tracking remained unsatisfactory.",
        sourceLabel: "Kerala State order, paras 2-4",
        sourceUrl: "https://indiankanoon.org/doc/103476297/",
      },
      {
        id: "VR-F2",
        title: "Disputed delivery proof",
        topic: ["facts"],
        text:
          "The order notes the consumer disputed the delivery signature and alleged that the tracking ID related to another item at another address.",
        sourceLabel: "Kerala State order, paras 5-6",
        sourceUrl: "https://indiankanoon.org/doc/103476297/",
      },
      {
        id: "VR-R1",
        title: "District relief left in place",
        topic: ["outcome", "remedy"],
        text:
          "The District Commission ordered supply or refund with interest, compensation of Rs. 3,00,000, and costs of Rs. 10,000; the State Commission dismissed the appeal.",
        sourceLabel: "Kerala State order, paras 8-10",
        sourceUrl: "https://indiankanoon.org/doc/103476297/",
      },
    ],
  },
  {
    id: "rohit-tiwari-amazon-2024",
    title: "Rohit Tiwari v. Amazon Seller Service Pvt. Ltd. & Another",
    shortTitle: "Rohit Tiwari v Amazon",
    forum: "State Consumer Disputes Redressal Commission, Uttar Pradesh",
    decisionDate: "2024-07-11",
    level: "State",
    platform: "Amazon",
    category: "Refund award enhancement",
    posture: "Consumer appeal for enhancement",
    disposition: "Appeal dismissed; District Commission order confirmed.",
    sourceUrl: "https://indiankanoon.org/doc/162503959/",
    sourceNote:
      "Seeded from a public appellate order mirror. The appellate order contains limited product-level facts, so the demo intentionally returns no-answer for unsupported product details.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The appellate order records that the District Commission allowed the complaint ex parte against two opposite parties and rejected it against the third.",
      "The consumer appealed only to enhance the award, arguing the District Commission did not adequately appreciate his evidence.",
      "The State Commission found no irregularity or illegality in the District Commission order and dismissed the appeal.",
    ],
    qa: {
      facts:
        "The seeded appellate order supports only that a District Commission complaint against Amazon-related opposite parties was allowed ex parte in part. It does not provide enough product-level facts to identify the item or defect.",
      outcome:
        "The State Commission dismissed the consumer's appeal and confirmed the District Commission judgment.",
      remedy:
        "The District Commission award confirmed on appeal required opposite parties 1 and 2, jointly or separately, to pay Rs. 15,998 with 6% simple annual interest from complaint filing until payment, plus Rs. 2,000 litigation costs.",
      law:
        "The appellate posture was under Section 41 of the Consumer Protection Act, 2019. The State Commission deferred to the District Commission because it found the lower order considered the record and had no illegality.",
    },
    chunks: [
      {
        id: "RT-F1",
        title: "Limited appellate facts",
        topic: ["facts"],
        text:
          "The appellate order identifies the parties and procedural history but does not state the product, defect, or transaction details.",
        sourceLabel: "U.P. State order, opening section",
        sourceUrl: "https://indiankanoon.org/doc/162503959/",
      },
      {
        id: "RT-R1",
        title: "District award",
        topic: ["remedy"],
        text:
          "The District Commission award recited in the appellate order was Rs. 15,998 with 6% simple interest and Rs. 2,000 costs.",
        sourceLabel: "U.P. State order, para 2",
        sourceUrl: "https://indiankanoon.org/doc/162503959/",
      },
      {
        id: "RT-O1",
        title: "Appeal dismissed",
        topic: ["outcome", "law"],
        text:
          "The State Commission held the District Commission order showed no irregularity or illegality and dismissed the enhancement appeal.",
        sourceLabel: "U.P. State order, final paragraphs",
        sourceUrl: "https://indiankanoon.org/doc/162503959/",
      },
    ],
  },
  {
    id: "dinesh-amazon-2018",
    title: "Amazon Seller Services Private Limited v. Dinesh",
    shortTitle: "Amazon v Dinesh",
    forum: "State Consumer Disputes Redressal Commission, U.T. Chandigarh",
    decisionDate: "2018-02-16",
    level: "State",
    platform: "Amazon",
    category: "Defective mobile handset",
    posture: "Marketplace appeal from District Forum order",
    disposition: "Appeal dismissed; District Forum order upheld.",
    sourceUrl: "https://indiankanoon.org/doc/130748060/",
    sourceNote:
      "Seeded from a public judgment mirror of the State Commission order; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer bought a mobile handset online for Rs. 10,418. It was replaced once but continued to malfunction within warranty.",
      "The handset repeatedly went to service centres and was not repaired to the consumer's satisfaction.",
      "The State Commission upheld refund, compensation, and costs, rejecting the platform's attempt to shift liability entirely to seller/manufacturer/service centre.",
    ],
    qa: {
      facts:
        "The consumer bought a mobile for Rs. 10,418, reported trouble within 10 days, received a replacement, and later faced repeated networking and working issues that service centres did not resolve.",
      outcome:
        "The State Commission dismissed Amazon's appeal at the preliminary stage and upheld the District Forum order.",
      remedy:
        "The upheld relief was refund of Rs. 10,418, Rs. 5,000 compensation for mental agony and harassment, and Rs. 5,000 litigation costs.",
      law:
        "The order relied on the platform-liability reasoning from Gopal Krishan: where goods bought through an online portal are substandard, the portal cannot entirely escape responsibility as a mere intermediary.",
    },
    chunks: [
      {
        id: "DN-F1",
        title: "Repeated handset failure",
        topic: ["facts"],
        text:
          "The order records a Rs. 10,418 handset purchase, replacement within the return window, and later repeated problems that service centres did not resolve.",
        sourceLabel: "Chandigarh State order, paras 2-4",
        sourceUrl: "https://indiankanoon.org/doc/130748060/",
      },
      {
        id: "DN-R1",
        title: "Refund and costs upheld",
        topic: ["outcome", "remedy"],
        text:
          "The District Forum awarded refund of invoice value, Rs. 5,000 compensation, and Rs. 5,000 litigation costs; the State Commission upheld it.",
        sourceLabel: "Chandigarh State order, paras 4 and 8",
        sourceUrl: "https://indiankanoon.org/doc/130748060/",
      },
      {
        id: "DN-L1",
        title: "Marketplace liability reasoning",
        topic: ["law"],
        text:
          "The Commission treated the online portal as unable to avoid all responsibility where the product was bought through it and proved substandard.",
        sourceLabel: "Chandigarh State order, paras 5-7",
        sourceUrl: "https://indiankanoon.org/doc/130748060/",
      },
    ],
  },
  {
    id: "gopal-krishan-amazon-2017",
    title: "Amazon Seller Services Private Limited v. Gopal Krishan",
    shortTitle: "Amazon v Gopal Krishan",
    forum: "State Consumer Disputes Redressal Commission, U.T. Chandigarh",
    decisionDate: "2017-02-17",
    level: "State",
    platform: "Amazon",
    category: "Defective Xiaomi mobile",
    posture: "Marketplace appeal from District Forum order",
    disposition: "Appeal dismissed; District Forum order upheld.",
    sourceUrl: "https://indiankanoon.org/doc/151884417/",
    sourceNote:
      "Seeded from public judgment mirrors/search excerpts because the primary mirror intermittently blocks direct fetches; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer bought a Xiaomi Redmi Note 3 through Amazon for Rs. 9,998 and reported defects after purchase.",
      "The repair path stalled, no standby handset was provided, and the consumer was asked for a dead-on-arrival report that the service channel would not issue.",
      "The State Commission upheld the District Forum's refund, compensation, and costs, stating that the online facilitator had a quality-responsibility role.",
    ],
    qa: {
      facts:
        "Gopal Krishan bought a Xiaomi Redmi Note 3 online for Rs. 9,998, found it defective, sent it for repair, did not get timely resolution, and was not given a standby handset.",
      outcome:
        "The State Commission dismissed Amazon's appeal and upheld the District Forum's consumer-favouring order.",
      remedy:
        "The upheld relief was refund of Rs. 9,998, Rs. 10,000 compensation for mental agony and physical harassment, and Rs. 5,000 litigation expenses.",
      law:
        "The order is often cited for the proposition that an online facilitator cannot escape liability when goods purchased through its portal are defective and the platform has a role in the transaction.",
    },
    chunks: [
      {
        id: "GK-F1",
        title: "Defective Xiaomi handset",
        topic: ["facts"],
        text:
          "The consumer purchased a Xiaomi Redmi Note 3 for Rs. 9,998 through the online portal and alleged defects plus delayed repair handling.",
        sourceLabel: "State Commission order, facts section",
        sourceUrl: "https://indiankanoon.org/doc/151884417/",
      },
      {
        id: "GK-R1",
        title: "District relief upheld",
        topic: ["outcome", "remedy"],
        text:
          "The appellate order upheld refund of the handset cost, compensation of Rs. 10,000, and litigation expenses of Rs. 5,000.",
        sourceLabel: "State Commission order, relief section",
        sourceUrl: "https://indiankanoon.org/doc/151884417/",
      },
      {
        id: "GK-L1",
        title: "Facilitator duty",
        topic: ["law"],
        text:
          "The Commission reasoned that the facilitator had a duty to ensure quality standards for goods sold through its portal and could not evade liability entirely.",
        sourceLabel: "State Commission order, liability analysis",
        sourceUrl: "https://indiankanoon.org/doc/151884417/",
      },
    ],
  },
  {
    id: "jaskaran-amazon-2017",
    title: "Amazon Seller Services Pvt. Ltd. v. Jaskaran Singh & Another",
    shortTitle: "Amazon v Jaskaran Singh",
    forum: "Himachal Pradesh State Consumer Disputes Redressal Commission",
    decisionDate: "2017-07-17",
    level: "State",
    platform: "Amazon",
    category: "Defective LED television",
    posture: "Marketplace appeal from District Forum order",
    disposition: "Appeal allowed for remand due to non-joinder of necessary parties.",
    sourceUrl: "https://indiankanoon.org/doc/130495126/",
    sourceNote:
      "Seeded from a public judgment mirror of the State Commission order; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The complainant bought a Micromax 40-inch LED TV through Amazon; when it arrived, half the screen allegedly did not work.",
      "The District Forum ordered refund and compensation against Amazon after the courier opposite party remained ex parte.",
      "The State Commission remanded the case because the seller Cloudtail and the named consumer/billing party were necessary parties that had not been impleaded.",
    ],
    qa: {
      facts:
        "Jaskaran Singh said a Micromax LED TV ordered from Amazon arrived defective, with half the screen not working. Amazon argued it was only a marketplace and that Cloudtail was the seller.",
      outcome:
        "The State Commission set aside the District Forum order and remanded the complaint for fresh decision after adding necessary parties.",
      remedy:
        "The District Forum's earlier refund and compensation order did not survive the appeal. The State Commission gave no final monetary relief and directed fresh adjudication.",
      law:
        "The key procedural point is non-joinder: the seller Cloudtail and the consumer/billing party were treated as necessary parties before merits could be decided.",
    },
    chunks: [
      {
        id: "JS-F1",
        title: "Defective television allegation",
        topic: ["facts"],
        text:
          "The complaint alleged that a Micromax 40-inch LED TV ordered through Amazon arrived with half the screen not working.",
        sourceLabel: "H.P. State order, facts section",
        sourceUrl: "https://indiankanoon.org/doc/130495126/",
      },
      {
        id: "JS-O1",
        title: "Remand for necessary parties",
        topic: ["outcome", "law"],
        text:
          "The State Commission held that Cloudtail and the billing/consumer party were necessary parties and remanded the case for fresh decision.",
        sourceLabel: "H.P. State order, final order",
        sourceUrl: "https://indiankanoon.org/doc/130495126/",
      },
      {
        id: "JS-R1",
        title: "No final appellate remedy",
        topic: ["remedy"],
        text:
          "Because the matter was remanded, the appellate order did not finally grant refund, compensation, or costs.",
        sourceLabel: "H.P. State order, final order",
        sourceUrl: "https://indiankanoon.org/doc/130495126/",
      },
    ],
  },
  {
    id: "vishwajit-amazon-2019",
    title: "Amazon Seller Services Private Limited v. Vishwajit Tapia",
    shortTitle: "Amazon v Vishwajit Tapia",
    forum: "State Consumer Disputes Redressal Commission, Punjab",
    decisionDate: "2019-12-03",
    level: "State",
    platform: "Amazon",
    category: "Old/defective mobile sold as new",
    posture: "Marketplace appeal from Patiala District Forum order",
    disposition: "Appeal dismissed with modification allowing collection of handset.",
    sourceUrl: "https://indiankanoon.org/doc/7085093/",
    sourceNote:
      "Seeded from a public judgment mirror of the State Commission order; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer bought a Moto G 3rd generation phone through Amazon and alleged the packaging looked old, the phone would not charge, and the warranty had already expired.",
      "Amazon argued it was only an intermediary marketplace and not the seller or manufacturer.",
      "The State Commission treated Amazon as more than a passive broker in the FBA-style transaction and upheld refund plus litigation costs.",
    ],
    qa: {
      facts:
        "The consumer bought a Moto G phone for Rs. 11,750, found the packaging and seal old, could not charge the phone, and was allegedly told the warranty had expired because it had been sold earlier.",
      outcome:
        "The State Commission dismissed Amazon's appeal, affirmed the District Forum order, and allowed Amazon to collect the handset from the consumer against receipt.",
      remedy:
        "The upheld remedy was refund of Rs. 11,750 and Rs. 3,000 litigation costs. The appellate modification allowed collection of the defective handset.",
      law:
        "The order discusses intermediary status, safe-harbour limits, FBA-style fulfilment, seller verification, and why an online marketplace may be treated as personally and jointly liable on these facts.",
    },
    chunks: [
      {
        id: "VT-F1",
        title: "Old phone and expired warranty",
        topic: ["facts"],
        text:
          "The consumer alleged the Moto G phone looked old, failed to charge, and could not get manufacturer service because the warranty had already expired.",
        sourceLabel: "Punjab State order, paras 3-4",
        sourceUrl: "https://indiankanoon.org/doc/7085093/",
      },
      {
        id: "VT-L1",
        title: "Marketplace not treated as passive",
        topic: ["law"],
        text:
          "The Commission reasoned that Amazon was not a mere broker where the order, receipts, fulfilment, and delivery ran through its platform and fulfilment system.",
        sourceLabel: "Punjab State order, paras 13-19",
        sourceUrl: "https://indiankanoon.org/doc/7085093/",
      },
      {
        id: "VT-R1",
        title: "Refund and collection modification",
        topic: ["outcome", "remedy"],
        text:
          "The appeal was dismissed, refund and costs were affirmed, and Amazon was allowed to collect the handset from the consumer.",
        sourceLabel: "Punjab State order, paras 21-24",
        sourceUrl: "https://indiankanoon.org/doc/7085093/",
      },
    ],
  },
  {
    id: "jaspreet-amazon-2024",
    title: "Amazon Seller Services Pvt. Ltd. v. Ms. Jaspreet Kaur & Another",
    shortTitle: "Amazon v Jaspreet Kaur",
    forum: "State Consumer Disputes Redressal Commission, Punjab",
    decisionDate: "2024-02-20",
    level: "State",
    platform: "Amazon",
    category: "Wrong product delivered",
    posture: "Marketplace appeal from Gurdaspur District Commission order",
    disposition: "Appeal dismissed; District Commission directions upheld.",
    sourceUrl: "https://indiankanoon.org/doc/188026850/",
    sourceNote:
      "Seeded primarily from public judgment mirrors; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer ordered a foldable laptop desk on Amazon but received a dirty rice bowl instead.",
      "Amazon offered refund after the return window issue, while the consumer insisted on replacement and pursued the matter through customer support, NCH, and the District Commission.",
      "The State Commission upheld the District Commission order and held Amazon personally and jointly liable for deficiency and harassment in this transaction.",
    ],
    qa: {
      facts:
        "Jaspreet Kaur ordered a foldable laptop table for Rs. 380 from Amazon but received a dirty rice bowl. She promptly sought replacement, filed an NCH complaint, and then approached the District Commission after refund/replacement discussions failed.",
      outcome:
        "The Punjab State Commission dismissed Amazon's appeal and upheld the District Commission order.",
      remedy:
        "The upheld District Commission directions required arranging delivery of the correct product through the seller or another vendor, Rs. 5,000 compensation, Rs. 5,000 litigation costs, and Rs. 10,000 punitive damages to the District Consumer Legal Aid Account.",
      law:
        "The decision applies the 2019 Act's consumer definition to online purchases and rejects a broad safe-harbour defence where Amazon's marketplace and fulfilment role made it answerable for wrong delivery.",
    },
    chunks: [
      {
        id: "JK-F1",
        title: "Wrong product received",
        topic: ["facts"],
        text:
          "The order records that a foldable laptop table order worth Rs. 380 resulted in delivery of a dirty rice bowl instead.",
        sourceLabel: "Punjab State order, facts section",
        sourceUrl: "https://indiankanoon.org/doc/188026850/",
      },
      {
        id: "JK-R1",
        title: "District directions upheld",
        topic: ["outcome", "remedy"],
        text:
          "The appeal was dismissed and the District Commission's directions for correct delivery, compensation, costs, and legal-aid punitive damages were upheld.",
        sourceLabel: "Punjab State order and public summary",
        sourceUrl: "https://www.casemine.com/judgement/in/65e077292616da45cba761fb",
      },
      {
        id: "JK-L1",
        title: "Online consumer and safe harbour",
        topic: ["law"],
        text:
          "The Commission treated the online buyer as a consumer under the 2019 Act and held Amazon personally and jointly liable despite its intermediary argument.",
        sourceLabel: "Punjab State order, liability analysis",
        sourceUrl: "https://indiankanoon.org/doc/188026850/",
      },
    ],
  },
  {
    id: "shankar-amazon-2024",
    title: "Shankar Mana Choudhari v. Amazon Seller Services Pvt. Ltd.",
    shortTitle: "Shankar Choudhari v Amazon",
    forum: "Maharashtra State Consumer Disputes Redressal Commission, Aurangabad Bench",
    decisionDate: "2024-01-30",
    level: "State",
    platform: "Amazon",
    category: "Old laptop sold as new",
    posture: "Consumer appeal for larger/joint relief",
    disposition: "Appeal dismissed; District Commission order maintained.",
    sourceUrl: "https://indiankanoon.org/doc/68689283/",
    sourceNote:
      "Seeded from a public judgment mirror of the State Commission order; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer bought an Asus laptop online for his son's classes and later alleged the service centre found it was old or previously repaired despite being sold as new.",
      "The District Commission found deficiency/unfair trade practice, ordering the seller to refund the price and Amazon to pay smaller compensation and costs.",
      "The State Commission dismissed the consumer's appeal for broader relief, but noted marketplace e-commerce duties under the E-Commerce Rules.",
    ],
    qa: {
      facts:
        "The consumer bought an Asus laptop for Rs. 61,990 for online classes. A service-centre report allegedly showed prior repair history and expired warranty, supporting the claim that an old laptop was sold as new.",
      outcome:
        "The Maharashtra State Commission dismissed the consumer's appeal and left the District Commission order unchanged.",
      remedy:
        "The District Commission order maintained on appeal directed the seller to refund Rs. 61,990 and directed Amazon to pay Rs. 5,000 compensation plus Rs. 1,500 complaint costs.",
      law:
        "The order references marketplace duties under the Consumer Protection (E-Commerce) Rules, including requiring sellers to ensure product descriptions and content match the goods' real nature, quality, purpose, and features.",
    },
    chunks: [
      {
        id: "SC-F1",
        title: "Laptop alleged old or previously repaired",
        topic: ["facts"],
        text:
          "The consumer said an Asus laptop bought as new for Rs. 61,990 was later found by the service centre to have prior repair history and expired warranty.",
        sourceLabel: "Maharashtra State order, paras 2 and 9",
        sourceUrl: "https://indiankanoon.org/doc/68689283/",
      },
      {
        id: "SC-R1",
        title: "District relief maintained",
        topic: ["outcome", "remedy"],
        text:
          "The District Commission directed the seller to refund the laptop price and Amazon to pay Rs. 5,000 compensation plus Rs. 1,500 costs; the appeal was dismissed.",
        sourceLabel: "Maharashtra State order, paras 4 and 11",
        sourceUrl: "https://indiankanoon.org/doc/68689283/",
      },
      {
        id: "SC-L1",
        title: "E-commerce rules noted",
        topic: ["law"],
        text:
          "The Commission noted marketplace e-commerce duties requiring sellers to keep descriptions, images, and other product content accurate.",
        sourceLabel: "Maharashtra State order, para 9",
        sourceUrl: "https://indiankanoon.org/doc/68689283/",
      },
    ],
  },
  {
    id: "love-kumar-amazon-2018",
    title: "Amazon Seller Services Pvt. Ltd. v. Love Kumar Sahu & Another",
    shortTitle: "Amazon v Love Kumar Sahu",
    forum: "Chhattisgarh State Consumer Disputes Redressal Commission",
    decisionDate: "2018-05-23",
    level: "State",
    platform: "Amazon",
    category: "Defective mobile handset",
    posture: "Marketplace appeal from Raipur District Forum order",
    disposition: "Appeal dismissed; District Forum order upheld.",
    sourceUrl: "https://indiankanoon.org/doc/174187164/",
    sourceNote:
      "Seeded from public search excerpts and cross-citations because the text mirror intermittently blocks direct fetches; official lookup route retained through e-Jagriti.",
    officialLookupUrl: eJagritiLookup,
    summary: [
      "The consumer dispute involved a mobile handset purchased online and alleged defect/deficiency.",
      "The District Forum ordered monetary relief against the opposite parties, and Amazon's appeal was dismissed by the Chhattisgarh State Commission.",
      "The case is useful in this narrow demo as another platform-liability example, but the local corpus intentionally contains fewer granular facts than cases with fuller accessible orders.",
    ],
    qa: {
      facts:
        "The accessible seed supports that Love Kumar Sahu's complaint concerned a defective mobile handset purchased through Amazon. It does not provide enough local-corpus detail for a richer fact narrative.",
      outcome:
        "The Chhattisgarh State Commission dismissed Amazon's appeal and upheld the District Forum's consumer-favouring order.",
      remedy:
        "The cross-cited order describes relief of Rs. 9,000, the mobile price, with 9% simple annual interest from complaint filing until realisation. The corpus does not support additional itemised relief beyond that.",
      law:
        "The case is cited alongside Gopal Krishan and later cases for online marketplace responsibility in defective-product disputes.",
    },
    chunks: [
      {
        id: "LS-F1",
        title: "Sparse accessible fact seed",
        topic: ["facts"],
        text:
          "The accessible seed identifies a defective mobile-handset consumer complaint involving Amazon and Micromax.",
        sourceLabel: "Chhattisgarh State order, accessible excerpts",
        sourceUrl: "https://indiankanoon.org/doc/174187164/",
      },
      {
        id: "LS-R1",
        title: "Refund with interest",
        topic: ["outcome", "remedy"],
        text:
          "A later public judgment excerpt describes the upheld District Forum relief as Rs. 9,000 with 9% simple annual interest.",
        sourceLabel: "Cross-citation in Animesh Baidya order",
        sourceUrl: "https://indiankanoon.org/doc/10496016/",
      },
      {
        id: "LS-L1",
        title: "Platform-liability line of cases",
        topic: ["law"],
        text:
          "The case is used in later consumer orders as part of a line treating marketplaces as potentially liable in defective-product transactions.",
        sourceLabel: "Later consumer-order citations",
        sourceUrl: "https://indiankanoon.org/doc/10496016/",
      },
    ],
  },
];

export const sampleQuestions = [
  "What are the key facts?",
  "What was the final outcome?",
  "What remedy was granted?",
  "What statutory or procedural point matters?",
  "Can I file a case like this tomorrow?",
];
