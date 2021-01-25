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
