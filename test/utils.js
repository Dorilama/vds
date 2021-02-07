// @ts-nocheck
import { test, only } from "zora";
import { toModel, straighten, layer, toVDS } from "../src/utils.js";
import makerjs from "makerjs";
import { readFile } from "fs/promises";

const empty = `<svg></svg>`;

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

const notFromZero = [
  `<svg>
    <path d="M 0 0 L 0 10 10 10" transform="translate(100, 10)"></path>
  </svg>`,
  "M 10 10 L 0 10 L 0 0",
];

const curve = `<svg>
  <path d="M 10 10 C 20 20, 40 20, 50 10"></path>
</svg>`;

test("toModel", async (t) => {
  t.equal(await toModel(""), null, "empty string");
  t.equal(await toModel(empty), null, "empty svg");
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
  t.equal(
    makerjs.exporter.toSVGPathData(await toModel(notFromZero[0])),
    notFromZero[1],
    "not from zero"
  );
});

test("straighten", async (t) => {
  const curveModel = straighten(await toModel(curve));
  const paths = new Set();
  makerjs.model.walk(curveModel, {
    onPath({ routeKey, pathContext }) {
      paths.add(pathContext.type);
    },
  });
  t.equal([...paths], ["line"], "straightened model contains only lines");
});

test("layer", (t) => {
  t.test("validate ok", (t) => {
    t.equal(layer.validate("NOCUT"), ["NOCUT"], "NOCUT");
    t.equal(
      layer.validate("NOCUT", "normal", "T40GREEN"),
      ["NOCUT"],
      "NOCUT with args"
    );
    [
      ["T40GREEN", ["normal", "reverse", "vgroove"]],
      ["T45BLUE", ["normal", "reverse"]],
      ["T90GREY", ["normal", "reverse"]],
      ["TPENGOLD", ["decor"]],
      ["TEMBVIOLET", ["debossing"]],
    ].forEach(([utensile, cuts]) => {
      cuts.forEach((c) => {
        t.equal(
          layer.validate(0, c, utensile),
          ["0", c, utensile],
          c + " " + utensile
        );
      });
    });
  });

  t.test("validate bad", (t) => {
    [
      [null, null, null],
      [null, "normal", "T90GREY"],
      [0, null, "T90GREY"],
      [0, "normal", null],
      [0, "badcut", "T90GREY"],
      [0, "normal", "badutensile"],
    ].forEach(([sheet, cut, utensile]) => {
      t.equal(
        layer.validate(sheet, cut, utensile),
        null,
        sheet + " " + cut + " " + utensile
      );
    });
    [
      ["T40GREEN", ["decor", "debossing"]],
      ["T45BLUE", ["decor", "debossing", "vgroove"]],
      ["T90GREY", ["decor", "debossing", "vgroove"]],
      ["TPENGOLD", ["normal", "reverse", "vgroove", "debossing"]],
      ["TEMBVIOLET", ["normal", "reverse", "vgroove", "decor"]],
    ].forEach(([utensile, cuts]) => {
      cuts.forEach((c) => {
        t.equal(layer.validate(0, c, utensile), null, c + " " + utensile);
      });
    });
    t.equal(
      layer.validate("hello.world", "normal", "T$)GREEN"),
      null,
      "dots in sheet string"
    );
    t.equal(
      layer.validate(1.3, "normal", "T$)GREEN"),
      null,
      "floating point numbers as sheet name"
    );
  });

  t.test("create", (t) => {
    t.equal(layer.create("NOCUT"), "NOCUT", "NOCUT");
    t.equal(
      layer.create(0, "normal", "T40GREEN"),
      "0.normal.T40GREEN",
      "valid create"
    );
    t.equal(layer.create(0, "decor", "T40GREEN"), null, "invalid create");
  });
  t.test("parse", (t) => {
    t.equal(layer.parse("NOCUT"), ["NOCUT"], "NOCUT");
    t.equal(layer.parse("NOCUT.cut"), ["NOCUT"], "NOCUT with something else");
    t.equal(
      layer.parse("0.normal.T40GREEN"),
      ["0", "normal", "T40GREEN"],
      "valid parse"
    );
    t.equal(layer.parse("0.decor.T40GREEN"), null, "valid parse");
  });
  t.test("modify", (t) => {
    t.equal(layer.modify("NOCUT", { sheet: 0 }), null, "invalid modify");
    t.equal(
      layer.modify("NOCUT", {
        sheet: 0,
        cut: "normal",
        utensile: "T40GREEN",
      }),
      "0.normal.T40GREEN",
      "valid modify"
    );
    t.equal(
      layer.modify("0.decor.TPENGOLD", {
        cut: "normal",
        utensile: "T40GREEN",
      }),
      "0.normal.T40GREEN",
      "valid modify"
    );
    t.equal(
      layer.modify("0.normal.TPENGOLD", {
        cut: "normal",
        utensile: "T40GREEN",
      }),
      null,
      "invalid original layer"
    );
    t.equal(
      layer.modify("0.decor.TPENGOLD", {
        cut: "decor",
        utensile: "T40GREEN",
      }),
      null,
      "invalid modify"
    );
  });
});

test("toVDS", async (t) => {
  const green = await readFile("./test/vds/green.vds", "utf8");
  const decor = await readFile("./test/vds/decor.vds", "utf8");
  const mixed = await readFile("./test/vds/mixed.vds", "utf8");
  const double = await readFile("./test/vds/double.vds", "utf8");
  const greenCut = new makerjs.models.Rectangle(100, 100);
  makerjs.model.layer(
    greenCut,
    layer.create("apertura-1", "normal", "T40GREEN")
  );
  const edge = new makerjs.models.Rectangle(greenCut, 50);
  makerjs.model.layer(edge, layer.create("NOCUT"));
  const decorCut = new makerjs.models.Rectangle(greenCut, 5);
  makerjs.model.layer(
    decorCut,
    layer.create("apertura-1", "decor", "TPENGOLD")
  );
  const skip = new makerjs.models.Rectangle(20, 20);
  t.equal(
    toVDS({ models: { greenCut, edge } }),
    { "apertura-1": green },
    "toVDS green"
  );
  t.equal(
    toVDS({ models: { greenCut, edge, skip } }),
    { "apertura-1": green },
    "toVDS skip model without layer"
  );
  t.equal(
    toVDS({ models: { greenCut, edge, decorCut } }),
    { "apertura-1": mixed },
    "toVDS mixed"
  );
  makerjs.model.layer(
    decorCut,
    layer.create("apertura-2", "decor", "TPENGOLD")
  );
  t.equal(
    toVDS({ models: { greenCut, edge, decorCut } }),
    { "apertura-1": green, "apertura-2": decor },
    "toVDS separate sheets"
  );
  const otherGreenCut = new makerjs.models.Rectangle(greenCut, 5);
  makerjs.model.addModel(greenCut, otherGreenCut);
  t.equal(
    toVDS({ models: { greenCut, edge } }),
    { "apertura-1": double },
    "toVDS double green cut"
  );
  t.equal(toVDS(toModel(`<svg></svg>`)), null, "empty model");
});
