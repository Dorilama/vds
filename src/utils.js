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
export const utensileList = [
  "T40GREEN",
  "T45BLUE",
  "T90GREY",
  "TPENGOLD",
  "TEMBVIOLET",
];
/** @type {["normal", "reverse", "vgroove", "decor", "debossing"]} */
export const cutList = ["normal", "reverse", "vgroove", "decor", "debossing"];
const cutMap = { normal: 0, reverse: 1, vgroove: 2, decor: 3, debossing: 5 };

/**
 * @typedef {typeof utensileList[number]} Utensile
 * @typedef {typeof cutList[number]} Cut
 */
/**
 * @type {Object<string,Utensile[]>}
 */
export const valid = {
  normal: ["T40GREEN", "T45BLUE", "T90GREY"],
  reverse: ["T40GREEN", "T45BLUE", "T90GREY"],
  vgroove: ["T40GREEN"],
  decor: ["TPENGOLD"],
  debossing: ["TEMBVIOLET"],
};

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

/**
 * Given a makerjs IModel
 * generate a valid VDS file
 * @param {IModel} model
 */
export const toVDS = (model) => {
  const straightened = straighten(model);
  const measure = makerjs.measure.modelExtents(straightened);
  if (!measure) {
    return null;
  }
  const { width, height } = measure;
  const pathData = makerjs.exporter.toSVGPathData(model, { byLayers: true });
  const sheets = Object.entries(pathData).reduce((p, [key, data]) => {
    if (key === "NOCUT") {
      return p;
    }
    const label = layer.parse(key);
    if (!label) {
      return p;
    }
    data = data.replace(/z/gi, "");
    const [sheet, cut, utensile] = label;
    if (!p[sheet]) {
      p[sheet] = [];
    }
    p[sheet].push([data, cut, utensile, width, height]);
    return p;
  }, {});
  const files = Object.entries(sheets).reduce((f, [key, data]) => {
    f[key] = vds(width, height, data);
    return f;
  }, {});
  return files;
};

/**
 *
 * @param {number} width
 * @param {number} height
 * @param {[string, Cut, Utensile, number, number][]} paths
 */
function vds(width, height, paths) {
  return `<?xml version="1.0" standalone="yes"?>
<NewDataSet>
  <Passepartout>
    <width> ${Math.ceil(width)}</width>
    <Height> ${Math.ceil(height)}</Height>
    <Notes />
    <Path></Path>
    <UM>mm</UM>
    <IsBox>False</IsBox>
  </Passepartout>
${paths
  .map(([d, cut, utensile], N) => path(d, cut, utensile, N, width, height))
  .join("\n")}
</NewDataSet>`;
}

/**
 *
 * @param {string} d
 * @param {Cut} cut
 * @param {Utensile} utensile
 * @param {number} N
 * @param {number} width
 * @param {number} height
 */
function path(d, cut, utensile, N, width, height) {
  return `  <PassElement-${N}->
    <PelId>${N}</PelId>
    <OriginalTopSize>&lt;Size xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;100000000,100000000&lt;/Size&gt;</OriginalTopSize>
    <OriginalBottomSize>&lt;Size xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;100000000,100000000&lt;/Size&gt;</OriginalBottomSize>
    <OriginalPosition>&lt;Point xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;0,0&lt;/Point&gt;</OriginalPosition>
    <TemplateCode>S${(N + 1).toString().padStart(3, "0")}</TemplateCode>
    <Position>&lt;Point xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;0,0&lt;/Point&gt;</Position>
    <Acceleration>0</Acceleration>
    <Speed>0</Speed>
    <LiftBlade>False</LiftBlade>
    <MyType />
    <TopBoundsReal>&lt;Rect xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;0,0,${width},${height}&lt;/Rect&gt;</TopBoundsReal>
    <BottomBoundsReal>&lt;Rect xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;0,0,${width},${height}&lt;/Rect&gt;</BottomBoundsReal>
    <Groups />
    <VMirrored>False</VMirrored>
    <OMirrored>False</OMirrored>
    <NumeroAperture>1</NumeroAperture>
    <RotationAngle> 0</RotationAngle>
    <CutIndex>0</CutIndex>
    <InfoLabel></InfoLabel>
  </PassElement-${N}->
  <Template-${N}->
    <PelID>${N}</PelID>
    <width> ${width}</width>
    <height> ${height}</height>
    <Position>&lt;Point xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;0,0&lt;/Point&gt;</Position>
    <Distances />
    <NumeroPathGeto>1</NumeroPathGeto>
    <largeVG>False</largeVG>
  </Template-${N}->
  <Apertura-${N}-0>
    <PelID>${N}</PelID>
    <GeoDraw>&lt;GeometryDrawing Brush="#FFA9A9A9" xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;&lt;GeometryDrawing.Pen&gt;&lt;Pen Brush="#FFFFFFFF" Thickness="1.3" LineJoin="Bevel" /&gt;&lt;/GeometryDrawing.Pen&gt;&lt;GeometryDrawing.Geometry&gt;&lt;PathGeometry Figures="${d}" /&gt;&lt;/GeometryDrawing.Geometry&gt;&lt;/GeometryDrawing&gt;</GeoDraw>
    <GeoDrawVideo>&lt;GeometryDrawing Brush="#FFA9A9A9" xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"&gt;&lt;GeometryDrawing.Pen&gt;&lt;Pen Brush="#FFFFFFFF" Thickness="1.3" LineJoin="Bevel" /&gt;&lt;/GeometryDrawing.Pen&gt;&lt;GeometryDrawing.Geometry&gt;&lt;PathGeometry Figures="" /&gt;&lt;/GeometryDrawing.Geometry&gt;&lt;/GeometryDrawing&gt;</GeoDrawVideo>
    <Layer>1</Layer>
    <CutType>${cutMap[cut]}</CutType>
    <UtensileCode>${utensile}</UtensileCode>
    <Number>1</Number>
  </Apertura-${N}-0>`;
}
