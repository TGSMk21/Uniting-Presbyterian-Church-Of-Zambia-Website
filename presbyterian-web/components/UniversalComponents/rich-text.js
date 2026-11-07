import { Fragment } from "react";
import { parseRichText } from "@/Utilities/pageContent.mjs";

// Wording from the dashboard: *stars* show as emphasis and line breaks are kept.
export default function RichText({ text }) {
  return parseRichText(text).map((token, index) => (
    <Fragment key={index}>
      {token.type === "br" ? <br /> : token.type === "em" ? <em>{token.value}</em> : token.value}
    </Fragment>
  ));
}
