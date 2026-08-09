//! Text embedding for the resident search index, mirroring the Python
//! `rhizome-search` model choice (BAAI/bge-small-en-v1.5) so vector ranking
//! stays comparable across the two implementations.

use fastembed::{EmbeddingModel, InitOptionsWithLength, TextEmbedding};
use std::path::Path;

/// Dependency-injection seam so index/BM25/lifecycle logic can be unit
/// tested without downloading the ~130MB ONNX model over the network.
pub trait TextEmbedder {
    fn embed_batch(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String>;

    fn embed_one(&mut self, text: &str) -> Result<Vec<f32>, String> {
        Ok(self
            .embed_batch(std::slice::from_ref(&text.to_string()))?
            .into_iter()
            .next()
            .unwrap_or_default())
    }
}

/// Real embedder: BGE-small-en-v1.5 via fastembed-rs (ONNX Runtime), model
/// weights lazily downloaded to `cache_dir` on first use.
pub struct FastEmbedTextEmbedder {
    model: TextEmbedding,
}

impl FastEmbedTextEmbedder {
    pub fn new(cache_dir: &Path) -> Result<Self, String> {
        let options = InitOptionsWithLength::new(EmbeddingModel::BGESmallENV15)
            .with_cache_dir(cache_dir.to_path_buf())
            .with_show_download_progress(true);
        let model = TextEmbedding::try_new(options)
            .map_err(|e| format!("Failed to load BGE-small embedding model: {e}"))?;
        Ok(Self { model })
    }
}

impl TextEmbedder for FastEmbedTextEmbedder {
    fn embed_batch(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        self.model
            .embed(texts, None)
            .map_err(|e| format!("Embedding failed: {e}"))
    }
}

/// Cosine similarity between two equal-length vectors. Returns 0.0 for a
/// zero-magnitude vector rather than dividing by zero.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm_a = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot / (norm_a * norm_b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cosine_similarity_identical_vectors_is_one() {
        let v = vec![1.0, 2.0, 3.0];
        assert!((cosine_similarity(&v, &v) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn cosine_similarity_orthogonal_vectors_is_zero() {
        assert!((cosine_similarity(&[1.0, 0.0], &[0.0, 1.0])).abs() < 1e-6);
    }

    #[test]
    fn cosine_similarity_zero_vector_is_zero_not_nan() {
        let result = cosine_similarity(&[0.0, 0.0], &[1.0, 1.0]);
        assert_eq!(result, 0.0);
    }

    #[test]
    fn cosine_similarity_mismatched_lengths_is_zero() {
        assert_eq!(cosine_similarity(&[1.0, 2.0], &[1.0]), 0.0);
    }
}
