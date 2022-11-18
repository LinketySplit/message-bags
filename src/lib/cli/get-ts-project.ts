import  { Project } from "ts-morph";

export const getTsProject = (): Project => {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json'
  });
  return project;
};
