import { experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";

const ARWEAVE_URL = "https://arweave.net";
const MINTBASE_ARWEAVE_URL = "https://ar.mintbase.xyz";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt");

    if (!prompt) {
      return new Response("Missing prompt parameter", { status: 400 });
    }
    const { image } = await generateImage({
      model: openai.image("dall-e-3"),
      prompt: prompt,
      size: "1024x1024",
    });

    const fileBuffer = Buffer.from(image.base64, "base64");

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer], { type: "image/jpeg" }),
      "image.jpeg"
    );

    const response = await fetch(MINTBASE_ARWEAVE_URL, {
      method: "POST",
      body: formData,
      headers: {
        "mb-api-key": "omni-site",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error uploading via arweave service: ${await response.text()}`
      );
    }

    const arweaveResponse = await response.json();
    const arweaveHash = arweaveResponse.id;

    if (!arweaveResponse || typeof arweaveHash !== "string") {
      throw new Error("Invalid response from arweave service");
    }

    const url = `${ARWEAVE_URL}/${arweaveHash}`;

    return Response.json({
      url,
      hash: arweaveHash,
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
