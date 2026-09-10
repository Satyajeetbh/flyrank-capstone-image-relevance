import { imageRepository } from "../dist/repositories/images.js";
import { postRepository } from "../dist/repositories/posts.js";

const postDefinitions = [
  {
    postId: "11111111-1111-4111-8111-111111111111",
    imageId: "animal-red-fox",
    title: "Tracking a Red Fox Through the Forest",
    content:
      "Red foxes are adaptable wild animals commonly found in forests, grasslands, and other natural environments.",
    expectedSubject: "red fox",
    expectedCategory: "animals",
  },
  {
    postId: "22222222-2222-4222-8222-222222222222",
    imageId: "animal-gray-wolf",
    title: "Gray Wolves in the Wild",
    content:
      "Gray wolves are social predators that live and hunt in packs across a range of wild habitats.",
    expectedSubject: "gray wolf",
    expectedCategory: "animals",
  },
  {
    postId: "33333333-3333-4333-8333-333333333333",
    imageId: "animal-brown-bear",
    title: "Brown Bears in Their Natural Habitat",
    content:
      "Brown bears inhabit forests and other wild environments where they forage for a wide variety of food.",
    expectedSubject: "brown bear",
    expectedCategory: "animals",
  },
  {
    postId: "44444444-4444-4444-8444-444444444444",
    imageId: "animal-tiger",
    title: "A Tiger in the Wild",
    content:
      "Tigers are large wild cats recognized by their distinctive striped coats and powerful build.",
    expectedSubject: "tiger",
    expectedCategory: "animals",
  },
  {
    postId: "55555555-5555-4555-8555-555555555555",
    imageId: "animal-rabbit",
    title: "Wild Rabbits in Open Grassland",
    content:
      "Wild rabbits can be found in open grassy environments where they feed on vegetation.",
    expectedSubject: "rabbit",
    expectedCategory: "animals",
  },
  {
    postId: "66666666-6666-4666-8666-666666666666",
    imageId: "animal-horse",
    title: "Horses Grazing Outdoors",
    content:
      "Horses are grazing animals that can often be seen feeding in open outdoor environments.",
    expectedSubject: "horse",
    expectedCategory: "animals",
  },
  {
    postId: "77777777-7777-4777-8777-777777777777",
    imageId: "vehicle-sedan-car",
    title: "A Sedan Car on the Road",
    content:
      "Sedan cars are common passenger vehicles designed for everyday transportation on roads.",
    expectedSubject: "sedan car",
    expectedCategory: "vehicles",
  },
  {
    postId: "88888888-8888-4888-8888-888888888888",
    imageId: "food-pizza",
    title: "A Freshly Prepared Pizza",
    content:
      "Pizza is a popular prepared food made with a baked base and a variety of toppings.",
    expectedSubject: "pizza",
    expectedCategory: "food",
  },
  {
    postId: "99999999-9999-4999-8999-999999999999",
    imageId: "landscape-mountain",
    title: "Mountain Landscapes and Their Terrain",
    content:
      "Mountain landscapes contain elevated terrain, natural formations, and varied outdoor scenery.",
    expectedSubject: "mountain",
    expectedCategory: "landscapes",
  },
  {
    postId: "abababab-abab-4aba-8aba-abababababab",
    imageId: "object-laptop",
    title: "Choosing a Laptop for Everyday Computing",
    content:
      "Laptops are portable computers used for everyday computing tasks such as browsing, writing, and working with applications.",
    expectedSubject: "laptop",
    expectedCategory: "objects",
  },
];

const images = await imageRepository.list();

for (const definition of postDefinitions) {
  const storageReference = `corpus/${definition.imageId}`;

  const image = images.find(
    (candidate) => candidate.storageReference === storageReference,
  );

  if (!image) {
    throw new Error(
      `Corpus image not found for ${definition.imageId}: ${storageReference}`,
    );
  }

  if (image.processingStatus !== "completed") {
    throw new Error(
      `Corpus image is not completed: ${definition.imageId} (${image.processingStatus})`,
    );
  }

  await postRepository.update(definition.postId, {
    title: definition.title,
    content: definition.content,
    expectedSubject: definition.expectedSubject,
    expectedCategory: definition.expectedCategory,
  });

  console.log(
    `Updated post ${definition.postId} -> ${definition.imageId} (${image.id})`,
  );
}

console.log(`Updated ${postDefinitions.length} evaluation posts.`);