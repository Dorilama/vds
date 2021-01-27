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

export const layer = {
  sep: ".",
  NOCUT: "NOCUT",
  /**
   * Given sheet ID, cut type and utensile type
   * return a string representing the layer label
   * @param {string|number} sheet the sheet ID
   * @param {Cut} [cut] the cut type
   * @param {Utensile} [utensile] the utensile type
   * @returns {string} the layer label
   */
  create(sheet, cut, utensile) {
    if (sheet === this.NOCUT) {
      return this.NOCUT + this.sep.repeat(2);
    }
    const validated = this.validate(cut, utensile);
    if (!validated) {
      return null;
    }
    const [c, u] = validated;
    return sheet + this.sep + c + this.sep + u;
  },
  /**
   *
   * @param {string} cut
   * @param {string} utensile
   * @returns {[Cut,Utensile]}
   */
  // validate(cut, utensile) {
  //   let c, u;
  //   if (!cut) {
  //     c = cutList[0];
  //   } else {
  //     c = cutList.find((v) => v === cut);
  //     if (!c) {
  //       return null;
  //     }
  //   }

  //   if (!utensile) {
  //     u = valid[c][0];
  //   } else {
  //     u = utensileList.find((v) => v === utensile);
  //     if (!u) {
  //       return null;
  //     }
  //   }
  //   if (!valid[c].includes(u)) {
  //     return null;
  //   }
  //   return [c, u];
  // },
  validate(cut, utensile) {
    if (!cut) {
      if (utensile) {
        let v = Object.entries(valid).find(([k, v]) =>
          v.find((s) => s === utensile)
        );
        if (v) {
          cut = v[0];
        } else {
          cut = cutList[0];
        }
      } else {
        cut = cutList[0];
      }
    }
    const c = cutList.find((v) => v === cut);
    if (!c) {
      return null;
    }
    if (!utensile) {
      utensile = valid[c][0];
    }
    const u = utensileList.find((v) => v === utensile);
    if (!u) {
      return null;
    }
    if (!valid[c].includes(u)) {
      return null;
    }
    return [c, u];
  },
  /**
   * Given a layer label string
   * return the parsed sheet ID, cut type and utensile type
   * @param {string} str
   * @returns {[string, Cut, Utensile]}
   */
  parse(str) {
    const split = str.split(this.sep);
    if (split.length !== 3) {
      return null;
    }
    const [sheet, cut, utensile] = split;
    if (sheet === this.NOCUT) {
      return [sheet, null, null];
    }
    const validated = this.validate(cut, utensile);
    if (!validated) {
      return null;
    }
    return [sheet, ...validated];
  },
  /**
   *
   * @param {string} str
   * @param {{sheet?: number|string, cut?: Cut, utensile?: Utensile}} param1
   */
  modify(str, { sheet, cut, utensile }) {
    if (sheet === this.NOCUT) {
      if (cut || utensile) {
        return null;
      }
      return this.NOCUT + this.sep.repeat(2);
    }
    return "null";
  },
};
