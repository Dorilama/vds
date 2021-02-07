import { render, html, Component, useState } from "uland";
import makerjs from "makerjs";
import { layer, toModel, toVDS } from "./utils.js";

const preview = Component(() => {
  const [model, setModel] = useState(null);
  const [name, setName] = useState(null);
  return html`
    <label
      class="dropimage"
      style=${model
        ? `background-size: contain;
    background-repeat: no-repeat;
    background-image: url("data:image/svg+xml;utf8,${encodeURIComponent(
      makerjs.exporter.toSVG(model)
    )}")`
        : null}
    >
      <input
        title="Drop image or click me"
        type="file"
        accept=".svg"
        onchange=${(e) => {
          if (!e.target.files[0]) {
            return;
          }
          setName(e.target.files[0].name);
          const reader = new FileReader();
          reader.onloadend = async () => {
            if (typeof reader.result !== "string") {
              return;
            }
            const original = reader.result;
            const model = await toModel(original);
            makerjs.model.layer(
              model,
              layer.create("green", "normal", "T40GREEN")
            );
            setModel(model);
          };
          reader.readAsText(e.target.files[0], "utf8");
        }}
      />
    </label>
    ${model
      ? html`<a
          href=${`data:text/plain;charset=utf-8,"${toVDS(model)["green"]}"`}
          class="pseudo button success"
          download=${name.replace(/\.svg$/, ".vds")}
          >Download VDS</a
        >`
      : null}
  `;
});

render(document.querySelector("#app"), preview());
