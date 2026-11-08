import { publicDemo } from "@/lib/public-demo";

const applicationFooterGroups = [
  {
    title: "Explore",
    links: [
      ["Why Margin", "/why-margin"],
      ["How it works", "/how-it-works"],
      ["About", "/why-margin#about"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help", "/help"],
      ["Contact", "/contact"],
      ["Community Guidelines", "/community-guidelines"],
      ["Accessibility", "/accessibility"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Copyright", "/copyright"],
    ],
  },
  {
    title: "Your information",
    links: [
      ["Your data", "/your-data"],
      ["Retention", "/retention"],
      ["Cookies", "/cookies"],
    ],
  },
];

export const publicFooterGroups = publicDemo
  ? [
      {
        ...applicationFooterGroups[0],
        links: [
          ...applicationFooterGroups[0].links,
          ["Explore Demo", "/demo/"],
        ],
      },
      {
        title: "Your information",
        links: [
          ["Your data", "/your-data"],
          ["Retention", "/retention"],
        ],
      },
    ]
  : applicationFooterGroups;
