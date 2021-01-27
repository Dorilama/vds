import { test } from "zora";
import { toModel, straighten, layer } from "../src/utils.js";
import makerjs from "makerjs";

test("utils", (t) => {
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

  t.test("layer", (t) => {
    t.test("explicit creation", (t) => {
      ["normal", "reverse", "vgroove"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "T40GREEN"),
          `0.${v}.T40GREEN`,
          `cut ${v} utensile T40GREEN`
        );
      });
      ["normal", "reverse"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "T45BLUE"),
          `0.${v}.T45BLUE`,
          `cut ${v} utensile T45BLUE`
        );
      });
      ["normal", "reverse"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "T90GREY"),
          `0.${v}.T90GREY`,
          `cut ${v} utensile T90GREY`
        );
      });
      t.equal(
        layer.create(0, "decor", "TPENGOLD"),
        `0.decor.TPENGOLD`,
        `cut decor utensile TPENGOLD`
      );
      t.equal(
        layer.create(0, "debossing", "TEMBVIOLET"),
        `0.debossing.TEMBVIOLET`,
        `cut debossing utensile TEMBVIOLET`
      );
    });

    t.test("implicit creation", (t) => {
      t.equal(layer.create(layer.NOCUT), "NOCUT..", "nocut");
      t.equal(layer.create(0), "0.normal.T40GREEN", "default create");
      t.equal(
        layer.create(layer.NOCUT, "normal", "T40GREEN"),
        "NOCUT..",
        "nocut with values"
      );
      t.equal(layer.create(0, "normal"), "0.normal.T40GREEN", "normal");
      t.equal(layer.create(0, "reverse"), "0.reverse.T40GREEN", "reverse");
      t.equal(layer.create(0, "decor"), "0.decor.TPENGOLD", "decor");
      t.equal(
        layer.create(0, "debossing"),
        "0.debossing.TEMBVIOLET",
        "debossing"
      );
      t.equal(layer.create(0, "vgroove"), "0.vgroove.T40GREEN", "vgroove");
      t.equal(layer.create(0, null, "T40GREEN"), "0.normal.T40GREEN");
      t.equal(layer.create(0, null, "T45BLUE"), "0.normal.T45BLUE");
      t.equal(layer.create(0, null, "T90GREY"), "0.normal.T90GREY");
      t.equal(layer.create(0, null, "TPENGOLD"), "0.decor.TPENGOLD");
      t.equal(layer.create(0, null, "TEMBVIOLET"), "0.debossing.TEMBVIOLET");
    });

    t.test("wrong creation", (t) => {
      ["normal", "reverse", "vgroove", "decor"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "TEMBVIOLET"),
          null,
          "wrong head TEMBVIOLET with cut " + v
        );
      });
      ["normal", "reverse", "vgroove", "debossing"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "TPENGOLD"),
          null,
          "wrong head TPENGOLD with cut " + v
        );
      });
      ["decor", "vgroove", "debossing"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "T45BLUE"),
          null,
          "wrong head T45BLUE with cut " + v
        );
      });
      ["decor", "vgroove", "debossing"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "T90GREY"),
          null,
          "wrong head T90GREY with cut " + v
        );
      });
      ["decor", "debossing"].forEach((v) => {
        t.equal(
          // @ts-ignore
          layer.create(0, v, "T40GREEN"),
          null,
          "wrong head T40GREEN with cut " + v
        );
      });
    });

    t.test("parse", (t) => {
      t.test("wrong string", (t) => {
        [
          "",
          "invalid label",
          layer.NOCUT,
          "0.normal",
          "0.normal.TEMBVIOLET",
          "0.reverse.TPENGOLD",
          "0.reverse.notool",
          "0.asdf.qwert",
        ].forEach((s) => {
          t.equal(layer.parse(s), null, s || "empty string");
        });
      });

      t.test("valid string", (t) => {
        /** @type {[string,any][]} */
        const samples = [
          [layer.NOCUT + layer.sep.repeat(2), [layer.NOCUT, null, null]],
          ["0.normal.T40GREEN", ["0", "normal", "T40GREEN"]],
          ["0.reverse.T45BLUE", ["0", "reverse", "T45BLUE"]],
          ["0.normal.T90GREY", ["0", "normal", "T90GREY"]],
          ["0.debossing.TEMBVIOLET", ["0", "debossing", "TEMBVIOLET"]],
          ["0.decor.TPENGOLD", ["0", "decor", "TPENGOLD"]],
          ["0.normal.", ["0", "normal", "T40GREEN"]],
          ["0.reverse.", ["0", "reverse", "T40GREEN"]],
          ["0.vgroove.", ["0", "vgroove", "T40GREEN"]],
          ["0.decor.", ["0", "decor", "TPENGOLD"]],
          ["0.debossing.", ["0", "debossing", "TEMBVIOLET"]],
        ];
        samples.forEach(([s, expected]) => {
          t.equal(layer.parse(s), expected, s);
        });
      });
    });

    // t.test("modify", (t) => {
    //   t.test("valid args", (t) => {
    //     [
    //       [{ sheet: layer.NOCUT }, "NOCUT.."],
    //       [{ sheet: 1 }, "1.normal.T40GREEN"],
    //       [{ utensile: "T45BLUE" }, "0.normal.T45BLUE"],
    //       [{ utensile: "T90GREY" }, "0.normal.T90GREY"],
    //       [{ cut: "decor" }, "0.decor.TPENGOLD"],
    //       [{ cut: "debossing" }, "0.decor.TEMBVIOLET"],
    //     ].forEach(([opt, s]) => {
    //       // @ts-ignore
    //       t.equal(layer.modify("0.normal.T40GREEN", opt), s);
    //     });
    //   });

    //   t.test("invalid args", (t) => {
    //     [
    //       { sheet: layer.NOCUT, cut: "normal" },
    //       { sheet: layer.NOCUT, utensile: "T40GREEN" },
    //     ].map((v) => {
    //       // @ts-ignore
    //       t.equal(layer.modify("0.normal.T40GREEN", v), null);
    //     });
    //   });
    // });
  });
  // t.test("toVds", async (t) => {
  //   // t.test('empty',t=>{
  //   //   const vds =
  //   // })
  //   const vds = toVds(new makerjs.models.Rectangle(10, 10));
  //   const [m, width, height] = vds.match(
  //     /<width>\s*(\d*)<\/width>\s*<Height>\s*(\d*)<\/Height>/
  //   );
  //   t.equal(width, "10", "width");
  //   t.equal(height, "10", "height");
  //   const regex = /<(PassElement)-(\d)->([^]*)<\/\1-\2->\s*<(Template)-\2->([^]*)<\/\4-\2->\s*<(Apertura)-\2-0>([^]*)<\/\6-\2-0>/g;
  //   const matches = vds.matchAll(regex);
  //   // for (const [m,_1,N,passElement,_4,template,_6,apertura] of matches) {
  //   //   tem
  //   //   t.test()
  //   // }
  // });
});
