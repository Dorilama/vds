import makerjs from "makerjs";
import { parse } from "svgson";
import svgpath from "svgpath";
import elementToPath from "element-to-path";

/**
 * svgpath toString method return a string without repeating paths commands
 * makerjs.importer.fromSVGPathData needs explicit commands on every line
 * see https://github.com/microsoft/maker.js/issues/341
 */
svgpath.prototype.toString = function () {
  this.__evaluateStack();
  return this.segments.map((s) => s.join(" ")).join(" ");
};

/**
 *
 * @typedef {import('makerjs').IModel} IModel
 * @typedef {import('svgson').INode} INode
 */

/**
 * Given an array of svgson INode
 * return an array of path data string
 * @param {INode[]} children
 * @param {string} transform
 * @returns {string[]}
 */
export const toPathData = (children, transform = "") => {
  const pathData = children.reduce((commands, child) => {
    transform += child.attributes.transform || "";
    const d = child.attributes.d || elementToPath(child);
    if (d) {
      commands.push(svgpath(d).transform(transform).toString());
    }
    return commands.concat(toPathData(child.children, transform));
  }, []);
  return pathData;
};

/**
 * Given an svg string
 * create a makerjs Imodel
 * @param {string} svgString
 * @returns {Promise<IModel>}
 */
export const toModel = async (svgString) => {
  const { attributes, children } = await parse(svgString);
  const pathData = toPathData(children);
  // start from an empty model  that can be converted in svg without errors
  const model = {
    paths: {
      _: { type: "line", origin: [0, 0], end: [0, 0] },
    },
  };
  pathData.forEach((d, N) => {
    makerjs.model.addModel(
      model,
      makerjs.importer.fromSVGPathData(d),
      "m_" + (N + 1)
    );
  });
  return model;
};

/**
 * Given a makerjs IModel
 * return a clone of the model with only line as paths
 * see https://github.com/microsoft/maker.js/issues/328
 * @param {IModel} model
 * @param {number} facetSize
 * @returns {IModel}
 */
export const straighten = (model, facetSize = 1) => {
  let newModel = makerjs.model.clone(model);
  // console.log(newModel);
  makerjs.model.walk(newModel, {
    onPath({ pathContext, pathId, modelContext }) {
      if (pathContext.type !== "line") {
        delete modelContext.paths[pathId];
        var points = makerjs.path.toKeyPoints(pathContext, facetSize);
        makerjs.model.addModel(
          newModel,
          new makerjs.models.ConnectTheDots(false, points),
          pathId
        );
      }
    },
  });
  return newModel;
};

/** @type {["T40GREEN", "T45BLUE", "T90GREY", "TPENGOLD", "TEMBVIOLET"]} */
const utensileList = [
  "T40GREEN",
  "T45BLUE",
  "T90GREY",
  "TPENGOLD",
  "TEMBVIOLET",
];
/** @type {["normal", "reverse", "vgroove", "decor", "debossing"]} */
const cutList = ["normal", "reverse", "vgroove", "decor", "debossing"];

/**
 * @typedef {typeof utensileList[number]} Utensile
 * @typedef {typeof cutList[number]} Cut
 */
/**
 * @type {Object<string,Utensile[]>}
 */
const valid = {
  normal: ["T40GREEN", "T45BLUE", "T90GREY"],
  reverse: ["T40GREEN", "T45BLUE", "T90GREY"],
  vgroove: ["T40GREEN"],
  decor: ["TPENGOLD"],
  debossing: ["TEMBVIOLET"],
};

/**
 * @namespace
 */
export const layer = {
  /**
   * Given sheet ID, cut type and utensile type
   * return a string representing the layer label
   * @typedef {(sheet: 'NOCUT', cut?: *, utensile?: *)=>string} CreateNocut
   * @typedef {(sheet: string|number, cut: Cut, utensile: Utensile)=>string} Create
   * @type {Create & CreateNocut}
   */
  create(sheet, cut, utensile) {
    const validated = this.validate(sheet, cut, utensile);
    if (!validated) {
      return null;
    }
    return validated.join(".");
  },
  /**
   * Vlidate layer label arguments
   * @param {string|number} sheet
   * @param {string} cut
   * @param {string} utensile
   * @returns {['NOCUT'] | [string, Cut, Utensile]}
   */
  validate(sheet, cut, utensile) {
    if (sheet === "NOCUT") {
      return ["NOCUT"];
    }
    if ((!sheet && sheet !== 0) || !cut || !utensile) {
      console.log(sheet, cut, utensile);
      return null;
    }
    sheet = sheet.toString();
    if (sheet.includes(".")) {
      return null;
    }
    const c = cutList.find((v) => v === cut);
    if (!c) {
      return null;
    }
    const u = utensileList.find((v) => v === utensile);
    if (!u) {
      return null;
    }
    if (!valid[c].includes(u)) {
      return null;
    }
    return [sheet, c, u];
  },
  /**
   * Given a layer label string
   * return the parsed sheet ID, cut type and utensile type
   * @param {string} str
   * @returns {['NOCUT'] | [string, Cut, Utensile]}
   */
  parse(str) {
    const [sheet, cut, utensile] = str.split(".");
    return this.validate(sheet, cut, utensile);
  },
  /**
   *
   * @param {string} str
   * @param {{sheet?: number|string, cut?: Cut, utensile?: Utensile}} opt
   */
  modify(str, { sheet, cut, utensile }) {
    const parsed = this.parse(str);
    if (!parsed) {
      return null;
    }
    if (sheet === 0) {
      sheet = "0";
    }
    const [s, c, u] = parsed;
    return this.create(sheet || s, cut || c, utensile || u);
  },
};
