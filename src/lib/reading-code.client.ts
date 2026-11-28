import { mountCodeFolds } from "./code-block"
import { installReadingFeature } from "./reading-features"

installReadingFeature("[data-has-code-folds]", mountCodeFolds)
