import { test } from "zora";
import { toModel, straighten } from "../src/utils.js";
import makerjs from "makerjs";

const empty = [`<svg></svg>`, ""];

const base = [
  `<svg>
    <path d="M 0 0 L 0 10 10 10"></path>
  </svg>`,
  "M 10 10 L 0 10 L 0 0",
];

const nested = [
  `<svg>
    <g>
      <path d="M 0 0 L 0 10 10 10"></path>
    </g>
  </svg>`,
  "M 10 10 L 0 10 L 0 0",
];

const element = [
  `<svg>
    <line x1="0" y1="0" x2="0" y2="10"></line>
    <line x1="0" y1="10" x2="10" y2="10"></line>
  </svg>`,
  "M 10 10 L 0 10 L 0 0",
];

const transform = [
  `<svg>
    <path d="M 0 0 L 0 10 10 10"></path>
    <path d="M 0 0 L 0 10" transform="translate(10 10)"></path>
  </svg>`,
  "M 10 20 L 10 10 L 0 10 L 0 0",
];
const nestedTransform = [
  `<svg>
    <path d="M 0 0 L 0 10 10 10"></path>
    <g transform="translate(10 0)">
      <path d="M 0 0 L 0 10" transform="translate(0 10)"></path>
    </g>
  </svg>`,
  "M 10 20 L 10 10 L 0 10 L 0 0",
];

const curve = `<svg>
  <path d="M 10 10 C 20 20, 40 20, 50 10"></path>
</svg>`;

test("utils", (t) => {
  t.test("toModel", async (t) => {
    t.equal(
      makerjs.exporter.toSVGPathData(await toModel(empty[0])),
      empty[1],
      "empty"
    );
    t.equal(
      makerjs.exporter.toSVGPathData(await toModel(base[0])),
      base[1],
      "base"
    );
    t.equal(
      makerjs.exporter.toSVGPathData(await toModel(nested[0])),
      nested[1],
      "nested"
    );
    t.equal(
      makerjs.exporter.toSVGPathData(await toModel(transform[0])),
      transform[1],
      "transform"
    );
    t.equal(
      makerjs.exporter.toSVGPathData(await toModel(nestedTransform[0])),
      nestedTransform[1],
      "nested transform"
    );
    t.equal(
      makerjs.exporter.toSVGPathData(await toModel(element[0])),
      element[1],
      "element"
    );
  });
  t.test("straighten", async (t) => {
    const curveModel = straighten(await toModel(curve));
    const paths = new Set();
    makerjs.model.walk(curveModel, {
      onPath({ routeKey, pathContext }) {
        paths.add(pathContext.type);
      },
    });
    t.equal([...paths], ["line"], "straightened model contains only lines");
  });
});
