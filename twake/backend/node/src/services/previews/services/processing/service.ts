import { generatePreview as thumbnailsFromImages } from "./image";
import { convertFromOffice } from "./office";
import { convertFromPdf } from "./pdf";
import { cleanFiles, isFileType } from "../../utils";
import { pdfExtensions, officeExtensions, imageExtensions } from "./mime";
import StorageAPI from "../../../../core/platform/services/storage/provider";
import { PreviewPubsubRequest, ThumbnailResult } from "../../types";

export class PreviewProcessService {
  name: "PreviewProcessService";
  version: "1";

  constructor(readonly storage: StorageAPI) {}

  async generateThumbnails(
    document: Pick<PreviewPubsubRequest["document"], "filename" | "mime" | "path">,
    options: PreviewPubsubRequest["output"],
    deleteTmpFile: boolean,
  ): Promise<ThumbnailResult[]> {
    if (isFileType(document.mime, document.filename, officeExtensions)) {
      const pdfPath = await convertFromOffice(document.path, {
        numberOfPages: options.pages,
      });
      await cleanFiles([document.path]);
      const thumbnailPath = await convertFromPdf(pdfPath.output, {
        numberOfPages: options.pages,
      });
      await cleanFiles([pdfPath.output]);
      const images = (await thumbnailsFromImages(thumbnailPath.output, options, deleteTmpFile))
        .output;
      await cleanFiles(thumbnailPath.output);
      return images;
    }

    if (isFileType(document.mime, document.filename, pdfExtensions)) {
      const thumbnailPath = await convertFromPdf(document.path, {
        numberOfPages: options.pages,
      });
      await cleanFiles([document.path]);
      const images = (await thumbnailsFromImages(thumbnailPath.output, options, deleteTmpFile))
        .output;
      await cleanFiles(thumbnailPath.output);
      return images;
    }

    if (isFileType(document.mime, document.filename, imageExtensions)) {
      const images = (await thumbnailsFromImages([document.path], options, deleteTmpFile)).output;
      await cleanFiles([document.path]);
      return images;
    }

    throw "Can not proccess, file type can't be defined";
  }
}
