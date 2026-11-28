import { mountImages } from "./image-reader"
import { installReadingFeature } from "./reading-features"

installReadingFeature("[data-has-images]", mountImages)
